import jwt from "jsonwebtoken";
import Staff from "../models/Staff.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      res.status(401);
      throw new Error("Not authorized, no token");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const staff = await Staff.findById(decoded.id).select("-password");

    if (!staff) {
      res.status(401);
      throw new Error("Not authorized, staff not found");
    }

    req.staff = staff;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      res.status(403);
      throw new Error("Access denied");
    }
    next();
  };
};