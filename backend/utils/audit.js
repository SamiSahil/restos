import AuditLog from "../models/AuditLog.js";
import { getClientIp } from "../middleware/ipBlocker.js";

export async function auditAction(req, action, meta = {}) {
  try {
    const ip = getClientIp(req);
    const staff = req.staff || null;

    await AuditLog.create({
      at: new Date(),
      ip,
      method: req.method,
      path: req.originalUrl,
      statusCode: 200,
      userAgent: req.headers["user-agent"] || "",
      referrer: req.headers["referer"] || "",
      staffId: staff?._id || null,
      staffRole: staff?.role || "",
      action,
      meta
    });
  } catch (e) {
    console.error("Audit action failed:", e.message);
  }
}