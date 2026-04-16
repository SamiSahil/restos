import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

settingSchema.index({ key: 1 }, { unique: true });

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;