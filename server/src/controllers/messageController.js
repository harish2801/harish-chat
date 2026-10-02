import mongoose from "mongoose";

import Message from "../models/Message.js";
import User from "../models/User.js";

// ========================================
// SEND TEXT MESSAGE
// ========================================

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;

    const { receiverId, text } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver ID",
      });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    // ========================================
    // CHECK RECEIVER
    // ========================================

    const receiver = await User.findOne({
      _id: receiverId,
      status: "ACTIVE",
      role: "USER",
    });

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    // ========================================
    // SELF CHAT
    // ========================================

    const isSelfChat =
      senderId.toString() === receiverId.toString();

    // ========================================
    // CREATE MESSAGE
    // ========================================

    const message = await Message.create({
      sender: senderId,

      receiver: receiverId,

      messageType: "TEXT",

      text: text.trim(),

      // Self-chat is always considered read.
      isRead: isSelfChat,

      readAt: isSelfChat
        ? new Date()
        : null,
    });

    // ========================================
    // POPULATE MESSAGE
    // ========================================

    const populatedMessage =
      await Message.findById(message._id)
        .populate(
          "sender",
          "name email"
        )
        .populate(
          "receiver",
          "name email"
        );

    // ========================================
    // SOCKET.IO
    // ========================================

    const io = req.app.get("io");

    if (io) {
      const senderRoom =
        `user:${senderId.toString()}`;

      const receiverRoom =
        `user:${receiverId.toString()}`;

      // Send to all sender devices.
      io.to(senderRoom).emit(
        "new-message",
        populatedMessage
      );

      // For normal chat, send to receiver too.
      // For self-chat, sender and receiver
      // are already the same room.
      if (
        senderId.toString() !==
        receiverId.toString()
      ) {
        io.to(receiverRoom).emit(
          "new-message",
          populatedMessage
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error(
      "Send Message Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to send message",
    });
  }
};

// ========================================
// GET CONVERSATION
// ========================================

export const getConversation = async (
  req,
  res
) => {
  try {
    const currentUserId =
      req.user._id;

    const { userId } =
      req.params;

    // ========================================
    // VALIDATE USER ID
    // ========================================

    if (
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // ========================================
    // CHECK CHAT USER
    // ========================================

    const chatUser =
      await User.findOne({
        _id: userId,
        status: "ACTIVE",
        role: "USER",
      }).select(
        "_id name email"
      );

    if (!chatUser) {
      return res.status(404).json({
        success: false,
        message:
          "Chat user not found or inactive",
      });
    }

    let query;

    // ========================================
    // SELF CHAT
    // ========================================

    if (
      currentUserId.toString() ===
      userId.toString()
    ) {
      query = {
        sender: currentUserId,
        receiver: currentUserId,
      };
    } else {
      // ========================================
      // NORMAL 1-TO-1 CHAT
      // ========================================

      query = {
        $or: [
          {
            sender: currentUserId,
            receiver: userId,
          },
          {
            sender: userId,
            receiver: currentUserId,
          },
        ],
      };
    }

    // ========================================
    // GET MESSAGES
    // ========================================

    const messages =
      await Message.find(query)
        .sort({
          createdAt: 1,
        })
        .populate(
          "sender",
          "name email"
        )
        .populate(
          "receiver",
          "name email"
        );

    return res.status(200).json({
      success: true,
      chatUser,
      messages,
    });
  } catch (error) {
    console.error(
      "Get Conversation Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load conversation",
    });
  }
};

// ========================================
// SEND FILE / IMAGE
// ========================================

export const sendFileMessage = async (
  req,
  res
) => {
  try {
    const senderId =
      req.user._id;

    const { receiverId } =
      req.body;

    // ========================================
    // VALIDATION
    // ========================================

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver is required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        receiverId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver ID",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a file",
      });
    }

    // ========================================
    // CHECK RECEIVER
    // ========================================

    const receiver =
      await User.findOne({
        _id: receiverId,
        status: "ACTIVE",
        role: "USER",
      });

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message:
          "User not found or inactive",
      });
    }

    // ========================================
    // FILE TYPE
    // ========================================

    const isImage =
      req.file.mimetype.startsWith(
        "image/"
      );

    // ========================================
    // SELF CHAT
    // ========================================

    const isSelfChat =
      senderId.toString() ===
      receiverId.toString();

    // ========================================
    // CREATE MESSAGE
    // ========================================

    const message =
      await Message.create({
        sender: senderId,

        receiver: receiverId,

        messageType:
          isImage
            ? "IMAGE"
            : "FILE",

        fileUrl:
          `/uploads/${req.file.filename}`,

        fileName:
          req.file.originalname,

        fileType:
          req.file.mimetype,

        isRead: isSelfChat,

        readAt: isSelfChat
          ? new Date()
          : null,
      });

    // ========================================
    // POPULATE MESSAGE
    // ========================================

    const populatedMessage =
      await Message.findById(
        message._id
      )
        .populate(
          "sender",
          "name email"
        )
        .populate(
          "receiver",
          "name email"
        );

    // ========================================
    // SOCKET.IO
    // ========================================

    const io =
      req.app.get("io");

    if (io) {
      const senderRoom =
        `user:${senderId.toString()}`;

      const receiverRoom =
        `user:${receiverId.toString()}`;

      io.to(senderRoom).emit(
        "new-message",
        populatedMessage
      );

      if (
        senderId.toString() !==
        receiverId.toString()
      ) {
        io.to(receiverRoom).emit(
          "new-message",
          populatedMessage
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error(
      "File Message Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to upload file",
    });
  }
};

// ========================================
// GET CHAT / CONVERSATION SUMMARY
// ========================================

export const getChatSummary = async (
  req,
  res
) => {
  try {
    const currentUserId =
      req.user._id;

    // ========================================
    // GET ACTIVE USERS
    // ========================================

    const users =
      await User.find({
        status: "ACTIVE",
        role: "USER",
      })
        .select(
          "_id name email"
        )
        .sort({
          name: 1,
        });

    const result = [];

    // ========================================
    // BUILD USER SUMMARY
    // ========================================

    for (const user of users) {
      const userId =
        user._id;

      const isSelf =
        userId.toString() ===
        currentUserId.toString();

      let conversationQuery;

      // ======================================
      // SELF CHAT
      // ======================================

      if (isSelf) {
        conversationQuery = {
          sender:
            currentUserId,

          receiver:
            currentUserId,
        };
      } else {
        // ====================================
        // NORMAL CHAT
        // ====================================

        conversationQuery = {
          $or: [
            {
              sender:
                currentUserId,

              receiver:
                userId,
            },
            {
              sender:
                userId,

              receiver:
                currentUserId,
            },
          ],
        };
      }

      // ======================================
      // LAST MESSAGE
      // ======================================

      const lastMessage =
        await Message.findOne(
          conversationQuery
        )
          .sort({
            createdAt: -1,
          })
          .select(
            [
              "text",
              "messageType",
              "fileName",
              "fileType",
              "fileUrl",
              "createdAt",
              "sender",
              "receiver",
              "isRead",
              "readAt",
            ].join(" ")
          );

      // ======================================
      // UNREAD COUNT
      // ======================================

      let unreadCount = 0;

      // Self chat should never show unread.
      if (!isSelf) {
        unreadCount =
          await Message.countDocuments({
            sender: userId,

            receiver:
              currentUserId,

            isRead: false,
          });
      }

      // ======================================
      // ADD USER
      // ======================================

      result.push({
        _id: user._id,

        name: user.name,

        email: user.email,

        isSelf,

        lastMessage:
          lastMessage || null,

        unreadCount,
      });
    }

    // ========================================
    // SELF USER FIRST
    // ========================================

    const selfUser =
      result.find(
        (user) =>
          user.isSelf
      );

    // ========================================
    // OTHER USERS ALPHABETICALLY
    // ========================================

    const otherUsers =
      result
        .filter(
          (user) =>
            !user.isSelf
        )
        .sort(
          (a, b) =>
            (a.name || "")
              .localeCompare(
                b.name || "",
                undefined,
                {
                  sensitivity:
                    "base",
                }
              )
        );

    const sortedUsers = [];

    if (selfUser) {
      sortedUsers.push(
        selfUser
      );
    }

    sortedUsers.push(
      ...otherUsers
    );

    return res.status(200).json({
      success: true,
      users: sortedUsers,
    });
  } catch (error) {
    console.error(
      "Chat Summary Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load chat summary",
    });
  }
};

// ========================================
// MARK CONVERSATION AS READ
// ========================================

export const markConversationAsRead =
  async (req, res) => {
    try {
      const currentUserId =
        req.user._id;

      const { userId } =
        req.params;

      // ======================================
      // VALIDATE USER ID
      // ======================================

      if (
        !mongoose.Types.ObjectId.isValid(
          userId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user ID",
        });
      }

      // ======================================
      // SELF CHAT
      // ======================================

      if (
        currentUserId.toString() ===
        userId.toString()
      ) {
        return res.status(200).json({
          success: true,

          modifiedCount: 0,

          message:
            "Self chat is already read",
        });
      }

      // ======================================
      // CHECK USER EXISTS
      // ======================================

      const chatUser =
        await User.findOne({
          _id: userId,
          status: "ACTIVE",
          role: "USER",
        }).select("_id");

      if (!chatUser) {
        return res.status(404).json({
          success: false,
          message:
            "Chat user not found or inactive",
        });
      }

      // ======================================
      // MARK RECEIVED MESSAGES AS READ
      // ======================================

      const readTime =
        new Date();

      const result =
        await Message.updateMany(
          {
            sender: userId,

            receiver:
              currentUserId,

            isRead: false,
          },
          {
            $set: {
              isRead: true,

              readAt:
                readTime,
            },
          }
        );

      // ======================================
      // SOCKET.IO
      // ======================================

      const io =
        req.app.get("io");

      if (io) {
        // ------------------------------------
        // Sync unread badge across all
        // current user's devices.
        // ------------------------------------

        io.to(
          `user:${currentUserId.toString()}`
        ).emit(
          "conversation-read",
          {
            userId:
              userId.toString(),

            readAt:
              readTime,

            modifiedCount:
              result.modifiedCount,
          }
        );

        // ------------------------------------
        // Tell original sender that the
        // messages were read.
        // ------------------------------------

        io.to(
          `user:${userId.toString()}`
        ).emit(
          "messages-read",
          {
            readBy:
              currentUserId.toString(),

            readAt:
              readTime,
          }
        );
      }

      return res.status(200).json({
        success: true,

        modifiedCount:
          result.modifiedCount,

        readAt:
          readTime,
      });
    } catch (error) {
      console.error(
        "Mark Read Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to mark messages as read",
      });
    }
  };