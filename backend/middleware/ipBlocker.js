import BlockedIP from "../models/BlockedIP.js";

// ✅ Named export (no duplicate declarations)
export function getClientIp(req) {
  // With app.set('trust proxy', 1), req.ip should be the real client IP
  const ip = (req.ip || "").toString();
  if (ip) return ip;

  // fallback if needed
  const xff = (req.headers["x-forwarded-for"] || "").toString();
  return xff.split(",")[0].trim();
}

export const ipBlocker = async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    if (!ip) return next();

    const blocked = await BlockedIP.findOne({ ip }).lean();
    if (blocked) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();
  } catch (e) {
    // If blocker fails, don't take down the app
    next();
  }
};