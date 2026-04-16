import Setting from "../models/Setting.js";
import { getIO } from "../config/socket.js";

export const getSettings = async (req, res, next) => {
  try {
    const discountSetting = await Setting.findOne({ key: "discountPercent" });

    res.json({
      success: true,
      data: {
        discountPercent: Number(discountSetting?.value || 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateDiscountSetting = async (req, res, next) => {
  try {
    let { discountPercent } = req.body;

    discountPercent = Number(discountPercent || 0);

    if (discountPercent < 0) discountPercent = 0;
    if (discountPercent > 100) discountPercent = 100;

    const setting = await Setting.findOneAndUpdate(
      { key: "discountPercent" },
      { value: discountPercent },
      { new: true, upsert: true }
    );

    const io = getIO();

    io.emit("settings:updated", {
      discountPercent: Number(setting.value || 0)
    });

    io.to("public").emit("settings:updated", {
      discountPercent: Number(setting.value || 0)
    });

    io.to("role:admin").emit("settings:updated", {
      discountPercent: Number(setting.value || 0)
    });

    io.to("role:manager").emit("settings:updated", {
      discountPercent: Number(setting.value || 0)
    });

    io.to("role:cashier").emit("settings:updated", {
      discountPercent: Number(setting.value || 0)
    });

    res.json({
      success: true,
      message: "Discount updated successfully",
      data: {
        discountPercent: Number(setting.value || 0)
      }
    });
  } catch (error) {
    next(error);
  }
};