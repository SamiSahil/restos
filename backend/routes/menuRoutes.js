import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} from "../controllers/menuController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(getMenuItems) // public menu OK
  .post(protect, authorize("admin","manager"), upload.single("image"), createMenuItem);

router.route("/:id")
  .get(getMenuItemById)
  .put(protect, authorize("admin","manager"), upload.single("image"), updateMenuItem)
  .delete(protect, authorize("admin","manager"), deleteMenuItem);

export default router;