import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "..", ".env")
});

console.log("ENV loaded from:", path.join(__dirname, "..", ".env"));
console.log("ENV CHECK:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI ? "FOUND" : "MISSING",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? "FOUND" : "MISSING",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? "FOUND" : "MISSING",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? "FOUND" : "MISSING"
});