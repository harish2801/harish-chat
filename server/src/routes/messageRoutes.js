import express from "express";

import {
  sendMessage,
  sendFileMessage,
  getConversation,
  getChatSummary,
  markConversationAsRead,
} from "../controllers/messageController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// ========================================
// SEND TEXT MESSAGE
// POST /api/messages
// ========================================

router.post(
  "/",
  protect,
  sendMessage
);

// ========================================
// SEND IMAGE / FILE
// POST /api/messages/upload
// ========================================

router.post(
  "/upload",
  protect,
  upload.single("file"),
  sendFileMessage
);

// ========================================
// CHAT SIDEBAR SUMMARY
// GET /api/messages/summary
// ========================================

router.get(
  "/summary",
  protect,
  getChatSummary
);

// ========================================
// MARK CONVERSATION AS READ
// PUT /api/messages/read/:userId
// ========================================

router.put(
  "/read/:userId",
  protect,
  markConversationAsRead
);

// ========================================
// GET CONVERSATION
// GET /api/messages/conversation/:userId
// ========================================

router.get(
  "/conversation/:userId",
  protect,
  getConversation
);

export default router;