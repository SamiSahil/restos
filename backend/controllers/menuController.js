import streamifier from "streamifier";
import MenuItem from "../models/MenuItem.js";
import cloudinary from "../config/cloudinary.js";

const uploadBufferToCloudinary = (buffer, folder = "restaurantos/menu") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 800, height: 600, crop: "fill", gravity: "auto" },
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

export const getMenuItems = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }

    if (category && category !== "All") {
      filter.category = category;
    }

    const items = await MenuItem.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    next(error);
  }
};

export const getMenuItemById = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      res.status(404);
      throw new Error("Menu item not found");
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

export const createMenuItem = async (req, res, next) => {
  try {
    console.log("REQ BODY:", req.body);
    console.log("REQ FILE:", req.file);

    const { name, category, price, emoji, stock, description } = req.body;

    let imageUrl = "";
    let imagePublicId = "";

if (req.file) {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    res.status(500);
    throw new Error("Cloudinary environment variables are missing on the server");
  }

  const uploaded = await uploadBufferToCloudinary(req.file.buffer);
  imageUrl = uploaded.secure_url;
  imagePublicId = uploaded.public_id;
}

    const item = await MenuItem.create({
      name,
      category,
      price,
      emoji,
      stock,
      description,
      imageUrl,
      imagePublicId
    });

    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: item
    });
  } catch (error) {
  console.error("CREATE MENU ITEM ERROR:", error);
  next(error);
}
};

export const updateMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      res.status(404);
      throw new Error("Menu item not found");
    }

    let imageUrl = item.imageUrl;
    let imagePublicId = item.imagePublicId;

if (req.file) {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    res.status(500);
    throw new Error("Cloudinary environment variables are missing on the server");
  }

  const uploaded = await uploadBufferToCloudinary(req.file.buffer);
  imageUrl = uploaded.secure_url;
  imagePublicId = uploaded.public_id;
}

    const updatedItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        imageUrl,
        imagePublicId
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      message: "Menu item updated successfully",
      data: updatedItem
    });
} catch (error) {
  console.error("UPDATE MENU ITEM ERROR:", error);
  next(error);
}
};

export const deleteMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      res.status(404);
      throw new Error("Menu item not found");
    }

    if (item.imagePublicId) {
      await cloudinary.uploader.destroy(item.imagePublicId);
    }

    await item.deleteOne();

    res.json({
      success: true,
      message: "Menu item deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateMenuItems = async (req, res, next) => {
  try {
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error("Request body must be a non-empty array");
    }

    const createdItems = await MenuItem.insertMany(items);

    res.status(201).json({
      success: true,
      message: `${createdItems.length} menu items inserted successfully`,
      data: createdItems
    });
  } catch (error) {
    next(error);
  }
};