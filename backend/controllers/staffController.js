import bcrypt from "bcryptjs";
import streamifier from "streamifier";
import Staff from "../models/Staff.js";
import cloudinary from "../config/cloudinary.js";
import { auditAction } from "../utils/audit.js";

const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1000, height: 700, crop: "limit" },
          { quality: "auto", fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const sanitizeStaffFields = (body) => {
  const monthlySalary = Math.max(0, Number(body.monthlySalary || 0));
  const workingDays = Math.max(1, Number(body.workingDays || 30));
  return { monthlySalary, workingDays };
};

const toDateOnlyString = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

const countMonthlyAttendance = (staff) => {
  const joinDate = staff.joinDate ? new Date(staff.joinDate) : new Date();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthly = (staff.attendance || []).filter((entry) => {
    const d = new Date(entry.date);
    return (
      d.getMonth() === month &&
      d.getFullYear() === year &&
      d >= new Date(joinDate.toISOString().slice(0, 10))
    );
  });

  return {
    presentDays: monthly.filter((e) => e.status === "active").length,
    absentDays: monthly.filter((e) => e.status === "inactive").length,
    leaveDays: monthly.filter((e) => e.status === "on-leave").length
  };
};

export const getStaffList = async (req, res, next) => {
  try {
    const staff = await Staff.find().select("-password").sort({ createdAt: -1 });

    const enriched = staff.map((person) => {
      const counts = countMonthlyAttendance(person);
      return { ...person.toObject(), ...counts };
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id).select("-password");

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const counts = countMonthlyAttendance(staff);

    res.json({ success: true, data: { ...staff.toObject(), ...counts } });
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      address,
      nidNumber,
      role,
      status,
      joinDate,
      leaveStartDate,
      leaveEndDate
    } = req.body;

    if (!fullName || !email || !phone || !password || !address) {
      res.status(400);
      throw new Error("Full name, email, phone, password, and address are required");
    }

    const existing = await Staff.findOne({ email });
    if (existing) {
      res.status(400);
      throw new Error("A staff member with this email already exists");
    }

    const photoFile = req.files?.photo?.[0] || null;
    const nidFile = req.files?.nidImage?.[0] || null;

    let photoUrl = "";
    let photoPublicId = "";
    if (photoFile) {
      const uploadedPhoto = await uploadBufferToCloudinary(photoFile.buffer, "restaurantos/staff-photos");
      photoUrl = uploadedPhoto.secure_url;
      photoPublicId = uploadedPhoto.public_id;
    }

    let nidImageUrl = "";
    let nidImagePublicId = "";
    if (nidFile) {
      const uploadedNid = await uploadBufferToCloudinary(nidFile.buffer, "restaurantos/staff-nid");
      nidImageUrl = uploadedNid.secure_url;
      nidImagePublicId = uploadedNid.public_id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const safeFields = sanitizeStaffFields(req.body);

    const staff = await Staff.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      address,

      photoUrl,
      photoPublicId,

      nidNumber,
      nidImageUrl,
      nidImagePublicId,

      role: role || "waiter",
      status: status || "active",
      monthlySalary: safeFields.monthlySalary,
      workingDays: safeFields.workingDays,
      joinDate: joinDate || new Date(),
      attendance: [],
      leaveStartDate: leaveStartDate || null,
      leaveEndDate: leaveEndDate || null
    });

    // ✅ Audit: staff created
    await auditAction(req, "staff_created", {
      staffId: staff._id,
      email: staff.email,
      role: staff.role,
      status: staff.status
    });

    const safeStaff = await Staff.findById(staff._id).select("-password");
    const counts = countMonthlyAttendance(safeStaff);

    res.status(201).json({
      success: true,
      message: "Staff created successfully",
      data: { ...safeStaff.toObject(), ...counts }
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const photoFile = req.files?.photo?.[0] || null;
    const nidFile = req.files?.nidImage?.[0] || null;

    let photoUrl = staff.photoUrl;
    let photoPublicId = staff.photoPublicId;

    if (photoFile) {
      if (staff.photoPublicId) {
        await cloudinary.uploader.destroy(staff.photoPublicId);
      }
      const uploadedPhoto = await uploadBufferToCloudinary(photoFile.buffer, "restaurantos/staff-photos");
      photoUrl = uploadedPhoto.secure_url;
      photoPublicId = uploadedPhoto.public_id;
    }

    let nidImageUrl = staff.nidImageUrl;
    let nidImagePublicId = staff.nidImagePublicId;

    if (nidFile) {
      if (staff.nidImagePublicId) {
        await cloudinary.uploader.destroy(staff.nidImagePublicId);
      }
      const uploadedNid = await uploadBufferToCloudinary(nidFile.buffer, "restaurantos/staff-nid");
      nidImageUrl = uploadedNid.secure_url;
      nidImagePublicId = uploadedNid.public_id;
    }

    if (req.body.password && req.body.password.trim()) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    } else {
      delete req.body.password;
    }

    const safeFields = sanitizeStaffFields(req.body);

    const updated = await Staff.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        monthlySalary: safeFields.monthlySalary,
        workingDays: safeFields.workingDays,
        photoUrl,
        photoPublicId,
        nidImageUrl,
        nidImagePublicId
      },
      { new: true, runValidators: true }
    ).select("-password");

    // ✅ Audit: staff updated
    await auditAction(req, "staff_updated", {
      staffId: updated._id,
      role: updated.role,
      status: updated.status
    });

    const counts = countMonthlyAttendance(updated);

    res.json({
      success: true,
      message: "Staff updated successfully",
      data: { ...updated.toObject(), ...counts }
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaffAttendance = async (req, res, next) => {
  try {
    const { status, date } = req.body;

    if (!["active", "inactive", "on-leave"].includes(status)) {
      res.status(400);
      throw new Error("Invalid attendance status");
    }

    const targetDate = toDateOnlyString(date);

    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const existingIndex = (staff.attendance || []).findIndex((entry) => entry.date === targetDate);

    if (existingIndex >= 0) {
      staff.attendance[existingIndex].status = status;
    } else {
      staff.attendance.push({ date: targetDate, status });
    }

    staff.status = status;
    await staff.save();

    // ✅ Audit: attendance updated
    await auditAction(req, "staff_attendance_updated", {
      staffId: staff._id,
      date: targetDate,
      status
    });

    const safeStaff = await Staff.findById(staff._id).select("-password");
    const counts = countMonthlyAttendance(safeStaff);

    res.json({
      success: true,
      message: "Attendance updated successfully",
      data: { ...safeStaff.toObject(), ...counts }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    if (staff.photoPublicId) {
      await cloudinary.uploader.destroy(staff.photoPublicId);
    }

    if (staff.nidImagePublicId) {
      await cloudinary.uploader.destroy(staff.nidImagePublicId);
    }

    await staff.deleteOne();

    // ✅ Audit: staff deleted
    await auditAction(req, "staff_deleted", {
      staffId: staff._id,
      email: staff.email,
      role: staff.role
    });

    res.json({ success: true, message: "Staff deleted successfully" });
  } catch (error) {
    next(error);
  }
};