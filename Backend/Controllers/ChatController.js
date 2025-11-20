// Backend/Controllers/ChatController.js
const Message = require("../Models/Message");
const User = require("../Models/User");
const mongoose = require("mongoose");

/**
 * REST: send message (authenticated)
 * body: { receiverId, content, meta }
 * Saves message and emits to recipient + sender via req.io if available.
 */
const sendMessageRest = async (req, res) => {
  try {
    const senderId = req.user?.id || req.user?._id;
    const { receiverId, content, meta } = req.body;

    if (!senderId) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (!receiverId || !mongoose.Types.ObjectId.isValid(String(receiverId))) {
      return res.status(400).json({ success: false, message: "Invalid receiverId" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Message content required" });
    }

    const convId = [String(senderId), String(receiverId)].sort().join("_");

    const message = new Message({
      conversationId: convId,
      senderId,
      receiverId,
      content: content.trim(),
      meta: meta || {},
      read: false,
    });

    await message.save();

    // Emit using socket if available (index.js attaches io to req)
    try {
      if (req.io) {
        req.io.to(`user_${receiverId}`).emit("newMessage", message);
        req.io.to(`user_${senderId}`).emit("newMessage", message);
        req.io.to(`conv_${convId}`).emit("newMessage", message);
      }
    } catch (e) {
      console.warn("ChatController: emit failed", e.message);
    }

    res.json({ success: true, message });
  } catch (err) {
    console.error("sendMessageRest:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /conversations
 * returns a list of conversation summaries for the authenticated user:
 * { _id: convId, other: { _id, name, email }, lastMessage, updatedAt }
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    // ensure userId is a valid ObjectId
const uid = new mongoose.Types.ObjectId(String(userId));


    // Aggregate last message per conversation involving this user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: uid }, { receiverId: uid }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          updatedAt: { $first: "$createdAt" },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
      { $limit: 200 },
    ]);

    // For each conversation, compute "other" user
    const results = await Promise.all(
      conversations.map(async (c) => {
        const lastMsg = c.lastMessage;
        const parts = String(c._id).split("_");
        const otherId = parts.find((p) => p !== String(userId)) || parts[0];

        let otherUser = null;
        if (mongoose.Types.ObjectId.isValid(otherId)) {
          otherUser = await User.findById(otherId, "name email");
        }

        return {
          _id: c._id,
          other: otherUser ? { _id: otherUser._id, name: otherUser.name, email: otherUser.email } : { _id: otherId, name: "User", email: null },
          lastMessage: {
            content: lastMsg.content,
            senderId: lastMsg.senderId,
            receiverId: lastMsg.receiverId,
            createdAt: lastMsg.createdAt,
            read: lastMsg.read,
          },
          updatedAt: c.updatedAt || lastMsg.createdAt,
        };
      })
    );

    res.json({ success: true, conversations: results });
  } catch (err) {
    console.error("getConversations:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /messages/:userId
 * Get all messages between authenticated user and :userId (sorted oldest->newest)
 */
const getMessages = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const otherId = req.params.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (!otherId) return res.status(400).json({ success: false, message: "other user id required" });

    const convId = [String(userId), String(otherId)].sort().join("_");

    const messages = await Message.find({ conversationId: convId }).sort({ createdAt: 1 }).lean();

    // mark messages as read where receiver is the authenticated user
    await Message.updateMany({ conversationId: convId, receiverId: String(userId), read: false }, { $set: { read: true } });

    res.json({ success: true, messages });
  } catch (err) {
    console.error("getMessages:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  sendMessageRest,
  getConversations,
  getMessages,
};
