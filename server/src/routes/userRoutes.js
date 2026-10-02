import express from "express";

import {
  getChatUsers,
} from "../controllers/userController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getChatUsers);

export default router;