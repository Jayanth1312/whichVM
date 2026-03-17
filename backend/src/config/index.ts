import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  cloudpriceKey: process.env.CLOUDPRICE_KEY,
  cronSecret: process.env.CRON_SECRET,

  // MongoDB
  mongoUri: process.env.MONGO_URI || "",
  dbName: process.env.DB_NAME || "whichvm",

  // Output directory for generated files (dev CDN replacement)
  outputDir:
    process.env.OUTPUT_DIR ||
    (require("path").join(__dirname, "../../output") as string),

  // Vercel Blob (production only)
  blobToken: process.env.BLOB_READ_WRITE_TOKEN,
  blobCdnUrl: process.env.BLOB_CDN_URL || "",
};
