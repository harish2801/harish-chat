import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// ========================================
// CHECK CLOUDINARY ENV VARIABLES
// ========================================

const requiredCloudinaryEnv = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

for (const key of requiredCloudinaryEnv) {
  if (!process.env[key]) {
    throw new Error(
      `${key} is missing in server/.env`
    );
  }
}

// ========================================
// CLOUDINARY CONFIGURATION
// ========================================

cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET,

  secure: true,
});

// ========================================
// CLOUDINARY STORAGE
// ========================================

const storage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => {
    // Remove extension from original filename
    const originalName =
      file.originalname
        .replace(/\.[^/.]+$/, "")
        .replace(
          /[^a-zA-Z0-9-_]/g,
          "_"
        );

    const uniqueName =
      `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}-${originalName}`;

    return {
      folder: "harish-chat",

      // Important:
      // allows images, PDF, Excel,
      // Word, CSV, etc.
      resource_type: "auto",

      public_id: uniqueName,
    };
  },
});

// ========================================
// ALLOWED FILE TYPES
// ========================================

const allowedMimeTypes = [
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // PDF
  "application/pdf",

  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  // CSV
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",

  // Text
  "text/plain",

  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ========================================
// FILE FILTER
// ========================================

const fileFilter = (
  req,
  file,
  cb
) => {
  console.log(
    "Uploading file:",
    file.originalname
  );

  console.log(
    "MIME type:",
    file.mimetype
  );

  if (
    allowedMimeTypes.includes(
      file.mimetype
    )
  ) {
    cb(null, true);
    return;
  }

  cb(
    new Error(
      `File type not allowed: ${file.mimetype}`
    ),
    false
  );
};

// ========================================
// MULTER UPLOAD
// ========================================

const upload = multer({
  storage,

  limits: {
    // Maximum file size = 15 MB
    fileSize:
      15 * 1024 * 1024,
  },

  fileFilter,
});

export default upload;