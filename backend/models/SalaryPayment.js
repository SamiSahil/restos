import mongoose from "mongoose";

const salaryPaymentSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true
    },

    // Salary period like "2026-03"
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"],
      index: true
    },

    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be at least 0.01"]
    },

    method: {
      type: String,
      enum: ["cash"],
      default: "cash"
    },

    // Your “proof”
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    note: {
      type: String,
      default: ""
    },

    paidAt: {
      type: Date,
      default: Date.now
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true
    },

    // Snapshot = strong proof even if salary changes later
   snapshot: {
  monthlySalary: Number,
  workingDays: Number,
  presentDays: Number,
  leaveDays: Number,
  paidEquivalentDays: Number,
  unpaidEquivalentDays: Number,
  payableAmount: Number,
  paidBefore: Number,
  dueBefore: Number
}
  },
  { timestamps: true }
);

salaryPaymentSchema.index({ staff: 1, month: 1, paidAt: -1 });

const SalaryPayment = mongoose.model("SalaryPayment", salaryPaymentSchema);
export default SalaryPayment;