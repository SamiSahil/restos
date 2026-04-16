import express from "express";
import {
  getTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable
} from "../controllers/tableController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
const router = express.Router();


router.route("/")
  .get(getTables) // OK public for table availability
  .post(protect, authorize("admin","manager"), createTable);

router.route("/:id")
  .get(protect, authorize("admin","manager","cashier","waiter","kitchen"), getTableById)
  .put(protect, authorize("admin","manager"), updateTable)
  .delete(protect, authorize("admin","manager"), deleteTable);

export default router;