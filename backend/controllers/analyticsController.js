import Order from "../models/Order.js";
import Feedback from "../models/Feedback.js";

export const getDashboardStats = async (req, res, next) => {
  try {
    const completedOrders = await Order.find({ status: "completed" }).populate("table");
    const allOrders = await Order.find().populate("table");

    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = allOrders.length;
    const avgOrderValue = completedOrders.length ? totalRevenue / completedOrders.length : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = allOrders.filter((order) => new Date(order.createdAt) >= today);

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        todayOrders: todayOrders.length,
        pendingOrders: allOrders.filter((o) => o.status === "pending").length,
        inProgressOrders: allOrders.filter((o) => o.status === "in-progress").length,
        completedOrders: allOrders.filter((o) => o.status === "completed").length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * STAFF: Sales analytics (your existing logic)
 */
export const getSalesAnalytics = async (req, res, next) => {
  try {
    const completedOrders = await Order.find({ status: "completed" });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = completedOrders.filter(
        (order) => new Date(order.createdAt) >= date && new Date(order.createdAt) < nextDate
      );

      const revenue = dayOrders.reduce((sum, order) => sum + order.total, 0);

      last7Days.push({
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        revenue
      });
    }

    const topSellingMap = {};
    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        topSellingMap[item.name] = (topSellingMap[item.name] || 0) + item.qty;
      });
    });

    const topSellingItems = Object.entries(topSellingMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const feedbacks = await Feedback.find();
    const avgRating = feedbacks.length
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
      : 0;

    res.json({
      success: true,
      data: {
        salesLast7Days: last7Days,
        topSellingItems,
        feedbackCount: feedbacks.length,
        avgRating: Number(avgRating.toFixed(1))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUBLIC: Top selling items based on billed orders only (accounting-safe)
 * GET /api/analytics/top-items?limit=10&days=30
 *
 * Returns:
 * [{ menuItemId, name, qty, revenue }]
 */
export const getTopItemsPublic = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await Order.aggregate([
      {
        $match: {
          billingStatus: "completed",
          billingCompletedAt: { $ne: null, $gte: since }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.menuItem",
          qty: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } },
          name: { $first: "$items.name" }
        }
      },
      { $sort: { qty: -1, revenue: -1 } },
      { $limit: limit }
    ]);

    const clean = (rows || []).filter((r) => r._id);

    res.json({
      success: true,
      data: clean.map((r) => ({
        menuItemId: String(r._id),
        name: r.name || "",
        qty: Number(r.qty || 0),
        revenue: Number((Number(r.revenue || 0)).toFixed(2))
      }))
    });
  } catch (error) {
    next(error);
  }
};