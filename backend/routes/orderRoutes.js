import express from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  updateBillingStatus,
  trackOrderPublic
} from "../controllers/orderController.js";
import { protect, authorize, optionalProtect } from "../middleware/authMiddleware.js";
import { publicOrderLimiter, publicTrackLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const limitPublicOnly = (limiter) => (req, res, next) => {
  // If optionalProtect identified a real logged-in staff, skip public limiter
  if (req.staff) return next();
  return limiter(req, res, next);
};

router.get("/track/:trackingCode", publicTrackLimiter, trackOrderPublic);

// staff-only
router
  .route("/")
  .get(protect, authorize("admin", "manager", "cashier", "kitchen", "waiter"), getOrders)
  .post(optionalProtect, limitPublicOnly(publicOrderLimiter), createOrder); // public ordering allowed + throttled

router
  .route("/:id")
  .get(protect, authorize("admin", "manager", "cashier", "kitchen", "waiter"), getOrderById)
  .delete(protect, authorize("admin", "manager"), deleteOrder);

router
  .route("/:id/status")
  .patch(protect, authorize("admin", "manager", "kitchen", "cashier"), updateOrderStatus);

router
  .route("/:id/billing-status")
  .patch(protect, authorize("admin", "manager", "cashier"), updateBillingStatus);

export default router;