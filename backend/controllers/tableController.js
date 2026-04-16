import Table from "../models/Table.js";
import Order from "../models/Order.js";
import { getIO } from "../config/socket.js";

export const getTables = async (req, res, next) => {
  try {
    const { status } = req.query;
    let filter = {};

    if (status) {
      filter.status = status;
    }

    const tables = await Table.find(filter).sort({ number: 1 });

    res.json({
      success: true,
      count: tables.length,
      data: tables
    });
  } catch (error) {
    next(error);
  }
};

export const getTableById = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      res.status(404);
      throw new Error("Table not found");
    }

    res.json({
      success: true,
      data: table
    });
  } catch (error) {
    next(error);
  }
};

export const createTable = async (req, res, next) => {
  try {
    const { number, seats, status } = req.body;

    const existingTable = await Table.findOne({ number });
    if (existingTable) {
      res.status(400);
      throw new Error("Table number already exists");
    }

    const table = await Table.create({
      number,
      seats,
      status: status || "available"
    });

    const io = getIO();
    io.emit("table:created", table);

    res.status(201).json({
      success: true,
      message: "Table created successfully",
      data: table
    });
  } catch (error) {
    next(error);
  }
};

export const updateTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      res.status(404);
      throw new Error("Table not found");
    }

    if (req.body.number && req.body.number !== table.number) {
      const duplicate = await Table.findOne({ number: req.body.number });
      if (duplicate) {
        res.status(400);
        throw new Error("Another table with this number already exists");
      }
    }

    const updatedTable = await Table.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    const io = getIO();
    io.emit("table:updated", updatedTable);

    res.json({
      success: true,
      message: "Table updated successfully",
      data: updatedTable
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      res.status(404);
      throw new Error("Table not found");
    }

    const activeOrders = await Order.find({
      table: table._id,
      status: { $in: ["pending", "in-progress"] }
    });

    if (activeOrders.length > 0) {
      res.status(400);
      throw new Error("Cannot delete table with active orders");
    }

    await table.deleteOne();

    const io = getIO();
    io.emit("table:deleted", { _id: req.params.id, number: table.number });

    res.json({
      success: true,
      message: "Table deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};