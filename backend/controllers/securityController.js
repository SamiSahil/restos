import AuditLog from "../models/AuditLog.js";
import BlockedIP from "../models/BlockedIP.js";
import { auditAction } from "../utils/audit.js";

export const getAuditLogs = async (req, res, next) => {
  try {
    const { ip, action, staffId, statusCode, path, limit = 100 } = req.query;

    const filter = {};
    if (ip) filter.ip = String(ip).trim();
    if (action) filter.action = String(action).trim();
    if (staffId) filter.staffId = staffId;
    if (statusCode) filter.statusCode = Number(statusCode);
    if (path) filter.path = { $regex: String(path).trim(), $options: "i" };

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const logs = await AuditLog.find(filter)
      .sort({ at: -1 })
      .limit(safeLimit)
      .lean();

    res.json({ success: true, count: logs.length, data: logs });
  } catch (e) {
    next(e);
  }
};

export const getBlockedIPs = async (req, res, next) => {
  try {
    const list = await BlockedIP.find().sort({ blockedAt: -1 }).lean();
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
};

export const blockIP = async (req, res, next) => {
  try {
    const { ip, reason = "" } = req.body;

    const safeIp = String(ip || "").trim();
    if (!safeIp) {
      res.status(400);
      throw new Error("ip is required");
    }

    const existing = await BlockedIP.findOne({ ip: safeIp });
    if (existing) {
      return res.json({ success: true, message: "IP already blocked", data: existing });
    }

    const doc = await BlockedIP.create({
      ip: safeIp,
      reason,
      blockedBy: req.staff?._id || null
    });

    await auditAction(req, "ip_blocked", { ip: safeIp, reason });

    res.status(201).json({ success: true, message: "IP blocked", data: doc });
  } catch (e) {
    next(e);
  }
};

export const unblockIP = async (req, res, next) => {
  try {
    const safeIp = String(req.params.ip || "").trim();
    if (!safeIp) {
      res.status(400);
      throw new Error("ip is required");
    }

    const deleted = await BlockedIP.findOneAndDelete({ ip: safeIp });
    await auditAction(req, "ip_unblocked", { ip: safeIp });

    res.json({ success: true, message: "IP unblocked", data: deleted });
  } catch (e) {
    next(e);
  }
};

export const getTopAbusiveIPs = async (req, res, next) => {
  try {
    const minutes = Math.min(Math.max(Number(req.query.minutes) || 60, 5), 24 * 60);
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const data = await AuditLog.aggregate([
      { $match: { at: { $gte: since }, path: { $regex: "^/api" } } },
      { $sort: { at: -1 } },
      {
        $group: {
          _id: "$ip",
          total: { $sum: 1 },
          bad: {
            $sum: {
              $cond: [{ $in: ["$statusCode", [401, 403, 429]] }, 1, 0]
            }
          },
          lastAt: { $first: "$at" },
          lastUserAgent: { $first: "$userAgent" },
          lastPath: { $first: "$path" },
          lastStatusCode: { $first: "$statusCode" }
        }
      },

      { $sort: { bad: -1, total: -1 } },
      { $limit: 10 }
    ]);

    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};