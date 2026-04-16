import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, index: true },

    ip: { type: String, default: "", index: true },
    method: { type: String, default: "" },
    path: { type: String, default: "" },
    statusCode: { type: Number, default: 0 },

    userAgent: { type: String, default: "" },
    referrer: { type: String, default: "" },

    // If staff is authenticated
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null, index: true },
    staffRole: { type: String, default: "" },

    // Optional: high-level action label
    action: { type: String, default: "", index: true },

    // Optional metadata: orderId, reason, etc.
    meta: { type: Object, default: {} }
  },
  { timestamps: false }
);

auditLogSchema.index({ ip: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });
auditLogSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });


const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;