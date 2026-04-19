import rateLimit from "express-rate-limit";

function makeHandler(limiterName) {
  return (req, res, _next, options) => {
    res.locals.auditAction = "rate_limited";
    res.locals.auditMeta = {
      limiter: limiterName
    };

    res.status(options.statusCode).json(options.message);
  };
}

export const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later."
  },
  handler: makeHandler("apiLimiter")
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again later."
  },
  handler: makeHandler("authLimiter")
});

export const publicOrderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Try again later." },
  handler: makeHandler("publicOrderLimiter")
});

export const publicTrackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many tracking attempts. Try again later." },
  handler: makeHandler("publicTrackLimiter")
});