// backend/scripts/backfillBillingCompletedAt.js
import "../config/env.js";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import dns from "dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find legacy billed orders missing billingCompletedAt
    const filter = {
      billingStatus: "completed",
      $or: [{ billingCompletedAt: null }, { billingCompletedAt: { $exists: false } }]
    };

    const count = await Order.countDocuments(filter);
    console.log(`Found ${count} orders to backfill...`);

    if (count === 0) {
      console.log("Nothing to do.");
      process.exit(0);
    }

    // Batch process to avoid memory spikes
    const batchSize = 500;
    let updatedTotal = 0;

    while (true) {
      const orders = await Order.find(filter)
        .select("_id createdAt updatedAt billingCompletedAt billingStatus")
        .limit(batchSize)
        .lean();

      if (!orders.length) break;

      const ops = orders.map((o) => {
        const completedAt = o.updatedAt || o.createdAt || new Date();

        return {
          updateOne: {
            filter: { _id: o._id, billingStatus: "completed", billingCompletedAt: { $in: [null, undefined] } },
            update: { $set: { billingCompletedAt: completedAt } }
          }
        };
      });

      const result = await Order.bulkWrite(ops, { ordered: false });
      const modified = result.modifiedCount || 0;
      updatedTotal += modified;

      console.log(`Batch updated: ${modified}, total updated so far: ${updatedTotal}`);
    }

    console.log(`✅ Backfill complete. Total updated: ${updatedTotal}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  }
}

run();