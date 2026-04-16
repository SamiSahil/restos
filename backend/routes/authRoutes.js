import express from "express";
import {
  loginStaff,
  getMe,
  setupFirstAdmin
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/login", authLimiter, loginStaff);
router.get("/me", protect, getMe);
router.post("/setup", setupFirstAdmin);

export default router;