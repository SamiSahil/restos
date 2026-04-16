import express from "express";
import {
  getDashboardStats,
  getSalesAnalytics,
  getTopItemsPublic
} from "../controllers/analyticsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Public endpoint for home page featured (best selling)
router.get("/top-items", getTopItemsPublic);

// Staff-only analytics
router.get("/dashboard", protect, authorize("admin", "manager", "cashier"), getDashboardStats);
router.get("/sales", protect, authorize("admin", "manager", "cashier"), getSalesAnalytics);

export default router;