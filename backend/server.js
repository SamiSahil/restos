import "./config/env.js";
import dns from "dns";
import http from "http";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import helmet from "helmet";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import { setIO } from "./config/socket.js";
import securityRoutes from "./routes/securityRoutes.js";
import { ipBlocker } from "./middleware/ipBlocker.js";
import { autoBlocker } from "./middleware/autoBlocker.js";
import { auditRequests } from "./middleware/auditMiddleware.js";
import menuRoutes from "./routes/menuRoutes.js";
import tableRoutes from "./routes/tableRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorMiddleware.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

connectDB();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5500",
  "http://127.0.0.1:5500",

  // Capacitor shells
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",

].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

setIO(io);

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("join:role", ({ role }) => {
    if (role) {
      socket.join(`role:${role}`);
      console.log(`👤 Socket ${socket.id} joined room role:${role}`);
    }
  });

  socket.on("join:public", () => {
    socket.join("public");
    console.log(`🌐 Socket ${socket.id} joined room public`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});
app.set("trust proxy", 1);
app.use(ipBlocker);
app.use(autoBlocker);
app.use(auditRequests);
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(compression());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); 
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api", apiLimiter);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "RestaurantOS API is running"
  });
});
app.use("/api/security", securityRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/settings", settingsRoutes);
app.use(notFound);
app.use(errorHandler);
app.use(auditRequests);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port http://localhost:${PORT}`);
});