import { v2 as cloudinary } from "cloudinary";

console.log("Cloudinary ENV check:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "MISSING",
  api_key: process.env.CLOUDINARY_API_KEY ? "FOUND" : "MISSING",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "FOUND" : "MISSING"
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export default cloudinary;