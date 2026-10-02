import express from "express";

import {
  getAllUsers,
  getPendingUsers,
  activateUser,
  deactivateUser,
} from "../controllers/adminController.js";

import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

// Every route below requires:
// 1. Valid login
// 2. ACTIVE account
// 3. ADMIN role

router.use(protect);
router.use(adminOnly);

router.get("/users", getAllUsers);

router.get("/users/pending", getPendingUsers);

router.put("/users/:id/activate", activateUser);

router.put("/users/:id/deactivate", deactivateUser);

export default router;