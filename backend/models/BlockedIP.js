import mongoose from "mongoose";

const blockedIPSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: "" },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    blockedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const BlockedIP = mongoose.model("BlockedIP", blockedIPSchema);
export default BlockedIP;