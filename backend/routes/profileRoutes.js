import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  getMyProfile,
  updateMyPhoto,
  updateMyPassword
} from "../controllers/profileController.js";

const router = express.Router();

router.get("/me", protect, getMyProfile);
router.put("/photo", protect, upload.single("photo"), updateMyPhoto);
router.put("/password", protect, updateMyPassword);

export default router;