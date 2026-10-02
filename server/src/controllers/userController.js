import User from "../models/User.js";

// ========================================
// GET ACTIVE CHAT USERS
// Logged-in user first
// Remaining users alphabetically
// ========================================

export const getChatUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const users = await User.find({
      status: "ACTIVE",
      role: "USER",
    })
      .select("_id name email status lastSeen")
      .sort({ name: 1 });

    const currentUser = users.find(
      (user) =>
        user._id.toString() === currentUserId.toString()
    );

    const otherUsers = users.filter(
      (user) =>
        user._id.toString() !== currentUserId.toString()
    );

    const sortedUsers = [];

    if (currentUser) {
      sortedUsers.push({
        ...currentUser.toObject(),
        isSelf: true,
      });
    }

    otherUsers.forEach((user) => {
      sortedUsers.push({
        ...user.toObject(),
        isSelf: false,
      });
    });

    return res.status(200).json({
      success: true,
      users: sortedUsers,
    });
  } catch (error) {
    console.error("Get Chat Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch chat users",
    });
  }
};