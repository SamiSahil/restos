import AuditLog from "../models/AuditLog.js";
import { getClientIp } from "./ipBlocker.js";

export const auditRequests = (req, res, next) => {
  const start = Date.now();

  res.on("finish", async () => {
    try {
      if (!req.originalUrl.startsWith("/api")) return;

      const staff = req.staff || null;
      const ip = getClientIp(req);

      const extraMeta =
        res.locals.auditMeta && typeof res.locals.auditMeta === "object"
          ? res.locals.auditMeta
          : {};

      await AuditLog.create({
        at: new Date(),
        ip,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        userAgent: req.headers["user-agent"] || "",
        referrer: req.headers["referer"] || "",
        staffId: staff?._id || null,
        staffRole: staff?.role || "",
        action: String(res.locals.auditAction || ""),
        meta: {
          durationMs: Date.now() - start,
          ...extraMeta
        }
      });
    } catch (err) {
      console.error("Audit request log failed:", err.message);
    }
  });

  next();
};