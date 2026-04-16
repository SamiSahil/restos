import express from "express";
import {
  getSettings,
  updateDiscountSetting
} from "../controllers/settingsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getSettings);
router.put("/discount", protect, authorize("admin", "manager"), updateDiscountSetting);

export default router;