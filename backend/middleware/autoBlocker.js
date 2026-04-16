import BlockedIP from "../models/BlockedIP.js";
import AuditLog from "../models/AuditLog.js";

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQ_PER_MIN = 30;
const MAX_BAD_PER_MIN = 10; // 401 + 403 threshold

// In-memory counters (resets with server restart)
const ipStats = new Map();

function now() {
  return Date.now();
}

function pruneOld(list, cutoff) {
  return list.filter((t) => t >= cutoff);
}

export const autoBlocker = (req, res, next) => {
  // ✅ Only watch API calls
  if (!req.originalUrl.startsWith("/api")) return next();

  const ip =
    (req.ip || "").toString() ||
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();

  if (!ip) return next();

  const cutoff = now() - WINDOW_MS;

  // initialize stats
  if (!ipStats.has(ip)) {
    ipStats.set(ip, { hits: [], bad: [] });
  }

  const entry = ipStats.get(ip);
  entry.hits = pruneOld(entry.hits, cutoff);
  entry.bad = pruneOld(entry.bad, cutoff);

  entry.hits.push(now());

  // After response finishes, check status codes
  res.on("finish", async () => {
    try {
      // record 401/403
      if (res.statusCode === 401 || res.statusCode === 403) {
        entry.bad.push(now());
      }

      // prune again
      entry.hits = pruneOld(entry.hits, cutoff);
      entry.bad = pruneOld(entry.bad, cutoff);

      const total = entry.hits.length;
      const bad = entry.bad.length;

      // ✅ rule: too many total AND too many bad
      if (total >= MAX_REQ_PER_MIN && bad >= MAX_BAD_PER_MIN) {
        const already = await BlockedIP.findOne({ ip }).lean();
        if (already) return;

        await BlockedIP.create({
          ip,
          reason: `Auto-block: ${total} req/min & ${bad} unauthorized/forbidden`
        });

        // also log action in AuditLog
        await AuditLog.create({
          at: new Date(),
          ip,
          method: "AUTO",
          path: "AUTO_BLOCKER",
          statusCode: 0,
          action: "ip_auto_blocked",
          meta: { totalReqPerMin: total, badReqPerMin: bad }
        });

        // optional: clear memory stats
        ipStats.delete(ip);
      }
    } catch (e) {
      // do not crash app
      console.error("autoBlocker error:", e.message);
    }
  });

  next();
};