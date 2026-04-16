import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Staff from "../models/Staff.js";
import { auditAction } from "../utils/audit.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
};

export const loginStaff = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      await auditAction(req, "staff_login_failed", { email: email || "", reason: "missing_email_or_password" });
      throw new Error("Email and password are required");
    }

    const staff = await Staff.findOne({ email });

    if (!staff) {
      res.status(401);
      await auditAction(req, "staff_login_failed", { email, reason: "staff_not_found" });
      throw new Error("Invalid email or password");
    }

    if (staff.status === "inactive") {
      res.status(403);
      await auditAction(req, "staff_login_failed", { email, staffId: staff._id, reason: "account_inactive" });
      throw new Error("This account is inactive");
    }

    const isMatch = await bcrypt.compare(password, staff.password);

    if (!isMatch) {
      res.status(401);
      await auditAction(req, "staff_login_failed", { email, staffId: staff._id, reason: "wrong_password" });
      throw new Error("Invalid email or password");
    }

    staff.lastLogin = new Date();
    await staff.save();

    await auditAction(req, "staff_login_success", {
      staffId: staff._id,
      email: staff.email,
      role: staff.role
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        _id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        status: staff.status,
        joinDate: staff.joinDate,
        lastLogin: staff.lastLogin,
        token: generateToken(staff._id)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.staff
    });
  } catch (error) {
    next(error);
  }
};

export const setupFirstAdmin = async (req, res, next) => {
  try {
    const existingStaff = await Staff.countDocuments();

    if (existingStaff > 0) {
      res.status(403);
      await auditAction(req, "setup_first_admin_failed", { reason: "staff_already_exists" });
      throw new Error("Setup already completed. Staff already exists. Use login instead.");
    }

    const { fullName, email, phone, password, address } = req.body;

    if (!fullName || !email || !phone || !password || !address) {
      res.status(400);
      await auditAction(req, "setup_first_admin_failed", {
        email: email || "",
        reason: "missing_required_fields"
      });
      throw new Error("fullName, email, phone, password, and address are required");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Staff.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      address,
      role: "admin",
      status: "active",
      joinDate: new Date()
    });

    const token = generateToken(admin._id);

    await auditAction(req, "setup_first_admin_success", {
      staffId: admin._id,
      email: admin.email
    });

    res.status(201).json({
      success: true,
      message: "First admin created successfully",
      data: {
        _id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        status: admin.status,
        joinDate: admin.joinDate,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};