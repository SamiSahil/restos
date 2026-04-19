import BlockedIP from "../models/BlockedIP.js";
import AuditLog from "../models/AuditLog.js";
import { getClientIp } from "./ipBlocker.js";

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQ_PER_MIN = 30;
const MAX_BAD_PER_MIN = 10; // 401 + 403 threshold

// ✅ Memory safety controls
const STALE_MS = 10 * 60 * 1000;        // remove IPs not seen for 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000;  // run cleanup every 1 minute
const MAX_IP_ENTRIES = 10000;           // hard cap to avoid unbounded Map growth

// Map preserves insertion order; we use it as a simple LRU by delete+set on access.
const ipStats = new Map();

function now() {
  return Date.now();
}

function pruneOld(list, cutoff) {
  return list.filter((t) => t >= cutoff);
}

function touchLRU(ip, entry) {
  // Move to the end (most recently used)
  if (ipStats.has(ip)) ipStats.delete(ip);
  ipStats.set(ip, entry);
}

function enforceMaxSize() {
  while (ipStats.size > MAX_IP_ENTRIES) {
    const oldestKey = ipStats.keys().next().value;
    if (!oldestKey) break;
    ipStats.delete(oldestKey);
  }
}

function cleanupStale() {
  const cutoff = now() - STALE_MS;

  for (const [ip, entry] of ipStats.entries()) {
    if (!entry?.lastSeen || entry.lastSeen < cutoff) {
      ipStats.delete(ip);
    }
  }

  enforceMaxSize();
}

// ✅ periodic cleanup (won't keep Node alive)
const interval = setInterval(cleanupStale, CLEANUP_INTERVAL_MS);
interval.unref?.();

export const autoBlocker = (req, res, next) => {
  // ✅ Only watch API calls
  if (!req.originalUrl.startsWith("/api")) return next();

  const ip = getClientIp(req);
  if (!ip) return next();

  const cutoff = now() - WINDOW_MS;

  // init stats
  let entry = ipStats.get(ip);
  if (!entry) {
    entry = { hits: [], bad: [], lastSeen: now() };
  }

  entry.lastSeen = now();
  entry.hits = pruneOld(entry.hits, cutoff);
  entry.bad = pruneOld(entry.bad, cutoff);

  entry.hits.push(now());

  // LRU move + enforce size cap
  touchLRU(ip, entry);
  enforceMaxSize();

  // After response finishes, check status codes
  res.on("finish", async () => {
    try {
      // record 401/403
      if (res.statusCode === 401 || res.statusCode === 403) {
        entry.bad.push(now());
      }

      // prune again (keep arrays bounded to the window)
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

        await AuditLog.create({
          at: new Date(),
          ip,
          method: "AUTO",
          path: "AUTO_BLOCKER",
          statusCode: 0,
          action: "ip_auto_blocked",
          meta: { totalReqPerMin: total, badReqPerMin: bad }
        });

        // clear memory stats for this IP after block
        ipStats.delete(ip);
      }
    } catch (e) {
      console.error("autoBlocker error:", e.message);
    }
  });

  next();
};