import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: false
    },
    name: {
      type: String,
      required: true
    },
    qty: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"]
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"]
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: Number,
      unique: true
    },
    trackingHash: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: false,
      default: null
    },
    orderType: {
      type: String,
      enum: ["dine-in", "delivery"],
      default: "dine-in"
    },
    customerName: {
      type: String,
      default: ""
    },
    customerPhone: {
      type: String,
      default: ""
    },
    deliveryAddress: {
      type: String,
      default: ""
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bKash", "Nagad", "Rocket", "COD"],
      default: "cash"
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: "Order must contain at least one item"
      }
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0
    },
    discountPercent: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100
    },
    discount: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending"
    },
    billingStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending"
    },
    paymentTransactionId: { type: String, default: "", trim: true },
    billingCompletedAt: {
      type: Date,
      default: null,
      index: true
   },
    prepStartedAt: {
      type: Date,
      default: null
    },
    estimatedPrepMinutes: {
      type: Number,
      default: null,
      min: 1
    },
    estimatedReadyAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ customerPhone: 1 });
orderSchema.index({ customerName: 1 });
orderSchema.index({ orderType: 1 });
orderSchema.index({ table: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;