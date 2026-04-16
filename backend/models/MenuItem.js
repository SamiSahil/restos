import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"]
    },
    emoji: {
      type: String,
      default: "🍽️"
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"]
    },
    description: {
      type: String,
      default: ""
    },
    imageUrl: {
      type: String,
      default: ""
    },
    imagePublicId: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

menuItemSchema.index({ name: 1 });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ stock: 1 });

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

export default MenuItem;