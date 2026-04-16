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
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();


router.get("/track/:trackingCode", trackOrderPublic);

// staff-only
router.route("/")
  .get(protect, authorize("admin","manager","cashier","kitchen","waiter"), getOrders)
  .post(createOrder); // keep public ordering allowed

router.route("/:id")
  .get(protect, authorize("admin","manager","cashier","kitchen","waiter"), getOrderById)
  .delete(protect, authorize("admin","manager"), deleteOrder);

router.route("/:id/status")
  .patch(protect, authorize("admin","manager","kitchen","cashier"), updateOrderStatus);

router.route("/:id/billing-status")
  .patch(protect, authorize("admin","manager","cashier"), updateBillingStatus);

export default router;