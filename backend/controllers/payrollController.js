import Staff from "../models/Staff.js";
import SalaryPayment from "../models/SalaryPayment.js";

function requireMonth(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    const err = new Error("month is required in YYYY-MM format");
    err.statusCode = 400;
    throw err;
  }
  return month;
}

function money(n) {
  return Number((Number(n || 0)).toFixed(2));
}

/**
 * New payroll rule:
 * - active = 1.0 day pay
 * - on-leave = 0.5 day pay
 * - inactive/missing = 0 day pay
 *
 * paidEquivalentDays can be decimal (keep decimals)
 */
function countAttendanceForMonth(staff, month) {
  const joinDateStr = staff.joinDate
    ? new Date(staff.joinDate).toISOString().slice(0, 10)
    : "0000-00-00";

  const entries = (staff.attendance || []).filter(
    (e) => e?.date && e.date.startsWith(month) && e.date >= joinDateStr
  );

  const presentDays = entries.filter((e) => e.status === "active").length;
  const leaveDays = entries.filter((e) => e.status === "on-leave").length;

  const paidEquivalentDays = presentDays + leaveDays * 0.5;

  const workingDays = Math.max(1, Number(staff.workingDays || 30));

  // Unpaid portion in "day-equivalents"
  const unpaidEquivalentDays = Math.max(workingDays - paidEquivalentDays, 0);

  return {
    workingDays,
    presentDays,
    leaveDays,
    paidEquivalentDays,
    unpaidEquivalentDays
  };
}

function calcPayable(monthlySalary, workingDays, paidEquivalentDays) {
  const daily = Number(monthlySalary || 0) / Math.max(1, Number(workingDays || 30));
  return money(daily * Number(paidEquivalentDays || 0));
}

function makeReceiptNumber(month) {
  return `SAL-${month}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export const getPayrollSummary = async (req, res, next) => {
  try {
    const month = requireMonth(req.query.month);

    const staffList = await Staff.find().select("-password").sort({ createdAt: -1 });
    const staffIds = staffList.map((s) => s._id);

    const payments = await SalaryPayment.find({
      month,
      staff: { $in: staffIds }
    }).lean();

    const paidMap = new Map();
    payments.forEach((p) => {
      const key = String(p.staff);
      paidMap.set(key, (paidMap.get(key) || 0) + Number(p.amount || 0));
    });

    const data = staffList.map((person) => {
      const monthlySalary = Number(person.monthlySalary || 0);
      const counts = countAttendanceForMonth(person, month);

      const payableAmount = calcPayable(monthlySalary, counts.workingDays, counts.paidEquivalentDays);
      const paidAmount = money(paidMap.get(String(person._id)) || 0);
      const dueAmount = money(Math.max(payableAmount - paidAmount, 0));

      return {
        staffId: person._id,
        fullName: person.fullName,
        email: person.email,
        phone: person.phone,
        role: person.role,
        status: person.status,
        joinDate: person.joinDate,
        monthlySalary,
        ...counts,
        payableAmount,
        paidAmount,
        dueAmount
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getPayrollPayments = async (req, res, next) => {
  try {
    const month = requireMonth(req.query.month);
    const staffId = req.query.staffId;

    if (!staffId) {
      res.status(400);
      throw new Error("staffId is required");
    }

    const payments = await SalaryPayment.find({ month, staff: staffId })
      .populate("paidBy", "fullName role")
      .sort({ paidAt: -1 });

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};

export const createPayrollPayment = async (req, res, next) => {
  try {
    const { staffId, month, amount, note = "" } = req.body;

    const safeMonth = requireMonth(month);

    if (!staffId) {
      res.status(400);
      throw new Error("staffId is required");
    }

    const payAmount = Number(amount || 0);
    if (payAmount <= 0) {
      res.status(400);
      throw new Error("amount must be greater than 0");
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    // Recalculate payable/due at payment time (strong proof)
    const counts = countAttendanceForMonth(staff, safeMonth);
    const monthlySalary = Number(staff.monthlySalary || 0);
    const payableAmount = calcPayable(monthlySalary, counts.workingDays, counts.paidEquivalentDays);

    const paidBeforeAgg = await SalaryPayment.aggregate([
      { $match: { staff: staff._id, month: safeMonth } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const paidBefore = money(paidBeforeAgg?.[0]?.total || 0);
    const dueBefore = money(Math.max(payableAmount - paidBefore, 0));

    if (dueBefore <= 0) {
      res.status(400);
      throw new Error("This staff has no due salary for the selected month");
    }

    if (payAmount > dueBefore) {
      res.status(400);
      throw new Error(`Payment amount exceeds due amount (${dueBefore})`);
    }

    const payment = await SalaryPayment.create({
      staff: staff._id,
      month: safeMonth,
      amount: money(payAmount),
      method: "cash",
      receiptNumber: makeReceiptNumber(safeMonth),
      note,
      paidAt: new Date(),
      paidBy: req.staff._id,
      snapshot: {
        monthlySalary,
        workingDays: counts.workingDays,
        presentDays: counts.presentDays,
        leaveDays: counts.leaveDays,
        paidEquivalentDays: counts.paidEquivalentDays,
        unpaidEquivalentDays: counts.unpaidEquivalentDays,
        payableAmount,
        paidBefore,
        dueBefore
      }
    });

    const populated = await SalaryPayment.findById(payment._id)
      .populate("staff", "fullName role phone")
      .populate("paidBy", "fullName role");

    res.status(201).json({
      success: true,
      message: "Salary payment recorded successfully",
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/payroll/summary/me?month=YYYY-MM
export const getMyPayrollSummary = async (req, res, next) => {
  try {
    const month = requireMonth(req.query.month);

    const staff = await Staff.findById(req.staff._id).select("-password");
    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const counts = countAttendanceForMonth(staff, month);
    const monthlySalary = Number(staff.monthlySalary || 0);

    const payableAmount = calcPayable(monthlySalary, counts.workingDays, counts.paidEquivalentDays);

    const paidBeforeAgg = await SalaryPayment.aggregate([
      { $match: { staff: staff._id, month } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const paidAmount = money(paidBeforeAgg?.[0]?.total || 0);
    const dueAmount = money(Math.max(payableAmount - paidAmount, 0));

    res.json({
      success: true,
      data: {
        staffId: staff._id,
        month,
        monthlySalary,
        ...counts,
        payableAmount,
        paidAmount,
        dueAmount
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/payroll/payments/me?month=YYYY-MM
export const getMyPayrollPayments = async (req, res, next) => {
  try {
    const month = requireMonth(req.query.month);

    const payments = await SalaryPayment.find({ month, staff: req.staff._id })
      .populate("paidBy", "fullName role")
      .sort({ paidAt: -1 });

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};