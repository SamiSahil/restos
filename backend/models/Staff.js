import mongoose from "mongoose";

const attendanceEntrySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["active", "inactive", "on-leave"],
      required: true
    }
  },
  { _id: false }
);

const staffSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true
    },

    password: {
      type: String,
      required: [true, "Password is required"]
    },

    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true
    },

    // ---- NEW: Staff profile photo (Cloudinary) ----
    photoUrl: {
      type: String,
      default: ""
    },

    photoPublicId: {
      type: String,
      default: ""
    },

    nidNumber: {
      type: String,
      default: "",
      trim: true
    },

    nidImageUrl: {
      type: String,
      default: ""
    },

    nidImagePublicId: {
      type: String,
      default: ""
    },

    role: {
      type: String,
      enum: ["admin", "manager", "cashier", "kitchen", "waiter"],
      default: "waiter"
    },

    status: {
      type: String,
      enum: ["active", "inactive", "on-leave"],
      default: "active"
    },

    monthlySalary: {
      type: Number,
      default: 0,
      min: [0, "Monthly salary cannot be negative"]
    },

    workingDays: {
      type: Number,
      default: 30,
      min: [1, "Working days must be at least 1"]
    },

    joinDate: {
      type: Date,
      default: Date.now
    },

    attendance: {
      type: [attendanceEntrySchema],
      default: []
    },

    leaveStartDate: {
      type: Date,
      default: null
    },

    leaveEndDate: {
      type: Date,
      default: null
    },

    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Useful indexes
staffSchema.index({ role: 1 });
staffSchema.index({ status: 1 });
staffSchema.index({ createdAt: -1 });

const Staff = mongoose.model("Staff", staffSchema);

export default Staff;