import express from "express";
import {
  getFeedbacks,
  getFeedbackById,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  setFeedbackHidden
} from "../controllers/feedbackController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(getFeedbacks)
  .post(createFeedback);

// NEW: hide/unhide (admin/manager)
router.patch("/:id/hide", protect, authorize("admin", "manager"), setFeedbackHidden);

// Hard delete (admin/manager)
router.delete("/:id", protect, authorize("admin", "manager"), deleteFeedback);

// keep if you need these:
router.route("/:id")
  .get(getFeedbackById)
  .put(protect, authorize("admin", "manager"), updateFeedback);

export default router;