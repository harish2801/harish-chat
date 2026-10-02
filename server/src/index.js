import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";

// ========================================
// ENVIRONMENT VARIABLE CHECK
// ========================================

const requiredEnvVariables = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CLIENT_URL",

  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingEnvVariables =
  requiredEnvVariables.filter(
    (key) => !process.env[key]
  );

if (missingEnvVariables.length > 0) {
  console.error(
    "❌ Missing environment variables:"
  );

  missingEnvVariables.forEach(
    (key) => {
      console.error(`   - ${key}`);
    }
  );

  console.error(
    "\nPlease check server/.env"
  );

  process.exit(1);
}

// ========================================
// ENVIRONMENT CHECK
// Do NOT print actual secret values
// ========================================

console.log(
  "Environment Configuration:"
);

console.log({
  mongodb: !!process.env.MONGODB_URI,

  jwtSecret:
    !!process.env.JWT_SECRET,

  clientUrl:
    !!process.env.CLIENT_URL,

  cloudinaryCloudName:
    !!process.env.CLOUDINARY_CLOUD_NAME,

  cloudinaryApiKey:
    !!process.env.CLOUDINARY_API_KEY,

  cloudinaryApiSecret:
    !!process.env.CLOUDINARY_API_SECRET,
});

// ========================================
// EXPRESS APP
// ========================================

const app = express();

// ========================================
// HTTP SERVER
// ========================================

const server =
  http.createServer(app);

// ========================================
// SOCKET.IO
// ========================================

const io = new Server(
  server,
  {
    cors: {
      origin:
        process.env.CLIENT_URL,

      methods: [
        "GET",
        "POST",
        "PUT",
        "DELETE",
      ],

      credentials: true,
    },
  }
);

// Make Socket.IO available
// inside controllers using:
//
// req.app.get("io")
//
app.set("io", io);

// ========================================
// CORS
// ========================================

app.use(
  cors({
    origin:
      process.env.CLIENT_URL,

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ========================================
// BODY PARSERS
// ========================================

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

// ========================================
// API ROUTES
// ========================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/messages",
  messageRoutes
);

// ========================================
// ROOT ROUTE
// ========================================

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      success: true,

      message:
        "Harish Chat API is running",

      environment:
        process.env.NODE_ENV ||
        "development",
    });
  }
);

// ========================================
// HEALTH CHECK
// ========================================

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,

      server: "running",

      database:
        mongoose.connection.readyState ===
        1
          ? "connected"
          : "disconnected",

      timestamp:
        new Date().toISOString(),
    });
  }
);

// ========================================
// SOCKET.IO CONNECTION
// ========================================

io.on(
  "connection",
  (socket) => {
    console.log(
      "Socket connected:",
      socket.id
    );

    // ====================================
    // USER JOINS PERSONAL ROOM
    // ====================================

    socket.on(
      "join-user",
      (userId) => {
        if (!userId) {
          return;
        }

        const roomName =
          `user:${userId}`;

        socket.join(
          roomName
        );

        console.log(
          `User ${userId} joined ${roomName}`
        );
      }
    );

    // ====================================
    // DISCONNECT
    // ====================================

    socket.on(
      "disconnect",
      (reason) => {
        console.log(
          "Socket disconnected:",
          socket.id,
          reason
        );
      }
    );
  }
);

// ========================================
// 404 API HANDLER
// ========================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      message:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

// ========================================
// GLOBAL ERROR HANDLER
// ========================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Server Error:",
      error
    );

    // Multer file too large
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "File is too large. Maximum size is 15 MB.",
      });
    }

    // Multer / file type error
    if (
      error.message?.includes(
        "file type"
      ) ||
      error.message?.includes(
        "File type"
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          error.message,
      });
    }

    return res.status(
      error.status || 500
    ).json({
      success: false,

      message:
        error.message ||
        "Internal server error",
    });
  }
);

// ========================================
// SERVER PORT
// ========================================

const PORT =
  process.env.PORT || 5000;

// ========================================
// START SERVER
// ========================================

const startServer =
  async () => {
    try {
      console.log(
        "Connecting to MongoDB..."
      );

      await mongoose.connect(
        process.env.MONGODB_URI
      );

      console.log(
        "✅ MongoDB Connected"
      );

      server.listen(
        PORT,
        () => {
          console.log(
            `✅ Server running on port ${PORT}`
          );

          console.log(
            `API: http://localhost:${PORT}`
          );

          console.log(
            `Health: http://localhost:${PORT}/api/health`
          );

          console.log(
            `Client: ${process.env.CLIENT_URL}`
          );
        }
      );
    } catch (error) {
      console.error(
        "❌ Server startup error:",
        error.message
      );

      process.exit(1);
    }
  };

startServer();