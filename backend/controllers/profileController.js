import bcrypt from "bcryptjs";
import Staff from "../models/Staff.js";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 800, height: 800, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// GET /api/profile/me
export const getMyProfile = async (req, res, next) => {
  try {
    // req.staff is set by protect middleware
    const staff = await Staff.findById(req.staff._id).select("-password");
    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    res.json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
};

// PUT /api/profile/photo  (multipart/form-data, field name: photo)
export const updateMyPhoto = async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.staff._id);
    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const photoFile = req.file;
    if (!photoFile) {
      res.status(400);
      throw new Error("photo file is required");
    }

    // delete old photo
    if (staff.photoPublicId) {
      await cloudinary.uploader.destroy(staff.photoPublicId);
    }

    const uploaded = await uploadBufferToCloudinary(photoFile.buffer, "restaurantos/staff-photos");
    staff.photoUrl = uploaded.secure_url;
    staff.photoPublicId = uploaded.public_id;

    await staff.save();

    const safe = await Staff.findById(staff._id).select("-password");

    res.json({
      success: true,
      message: "Profile photo updated successfully",
      data: safe
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/profile/password  (JSON)
// body: { currentPassword, newPassword }
export const updateMyPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400);
      throw new Error("currentPassword and newPassword are required");
    }

    if (String(newPassword).trim().length < 4) {
      res.status(400);
      throw new Error("New password must be at least 4 characters");
    }

    const staff = await Staff.findById(req.staff._id);
    if (!staff) {
      res.status(404);
      throw new Error("Staff not found");
    }

    const isMatch = await bcrypt.compare(currentPassword, staff.password);
    if (!isMatch) {
      res.status(401);
      throw new Error("Current password is incorrect");
    }

    staff.password = await bcrypt.hash(newPassword, 10);
    await staff.save();

    res.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    next(error);
  }
};