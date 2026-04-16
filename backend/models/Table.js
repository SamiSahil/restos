import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: [true, "Table number is required"],
      unique: true
    },
    seats: {
      type: Number,
      required: [true, "Seats count is required"],
      min: [1, "Seats must be at least 1"]
    },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved"],
      default: "available"
    }
  },
  {
    timestamps: true
  }
);

tableSchema.index({ number: 1 });
tableSchema.index({ status: 1 });

const Table = mongoose.model("Table", tableSchema);

export default Table;