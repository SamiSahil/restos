import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getAuditLogs,
  getBlockedIPs,
  blockIP,
  unblockIP,
  getTopAbusiveIPs
} from "../controllers/securityController.js";

const router = express.Router();

// Admin/Manager only
router.get("/logs", protect, authorize("admin", "manager"), getAuditLogs);
router.get("/top-abuse", protect, authorize("admin", "manager"), getTopAbusiveIPs);
router.get("/blocked-ips", protect, authorize("admin", "manager"), getBlockedIPs);
router.post("/block-ip", protect, authorize("admin", "manager"), blockIP);
router.delete("/block-ip/:ip", protect, authorize("admin", "manager"), unblockIP);

export default router;