import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getPayrollSummary,
  getPayrollPayments,
  createPayrollPayment,
  getMyPayrollSummary,
  getMyPayrollPayments
} from "../controllers/payrollController.js";

const router = express.Router();

// Staff self-view (any logged in staff)
router.get("/summary/me", protect, getMyPayrollSummary);
router.get("/payments/me", protect, getMyPayrollPayments);

// Admin/Manager payroll management
router.get("/summary", protect, authorize("admin", "manager"), getPayrollSummary);
router.get("/payments", protect, authorize("admin", "manager"), getPayrollPayments);
router.post("/payments", protect, authorize("admin", "manager"), createPayrollPayment);

export default router;