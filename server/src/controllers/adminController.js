import mongoose from "mongoose";
import User from "../models/User.js";

// ========================================
// GET ALL USERS
// ========================================
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users",
    });
  }
};

// ========================================
// GET PENDING USERS
// ========================================
export const getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({
      status: "PENDING",
    })
      .select("-password")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Pending Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch pending users",
    });
  }
};

// ========================================
// ACTIVATE USER
// ========================================
export const activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Admin account cannot be changed here",
      });
    }

    user.status = "ACTIVE";

    await user.save();

    return res.status(200).json({
      success: true,
      message: `${user.name} activated successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Activate User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to activate user",
    });
  }
};

// ========================================
// DEACTIVATE USER
// ========================================
export const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Admin account cannot be deactivated here",
      });
    }

    user.status = "INACTIVE";

    await user.save();

    return res.status(200).json({
      success: true,
      message: `${user.name} deactivated successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Deactivate User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate user",
    });
  }
};