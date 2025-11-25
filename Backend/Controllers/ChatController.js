// Backend/Controllers/ChatController.js
const Message = require("../Models/Message");
const User = require("../Models/User");
const mongoose = require("mongoose");

/**
 * POST /api/chats/send
 * body: { receiverId, content, meta }
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

    // populate sender's name/email for notifications
    await message.populate({ path: "senderId", select: "name email" });

    const emitted = {
      _id: message._id,
      conversationId: message.conversationId,
      senderId: String(message.senderId._id || message.senderId),
      receiverId: String(message.receiverId),
      content: message.content,
      meta: message.meta,
      read: message.read,
      createdAt: message.createdAt,
      senderName: message.senderId?.name || null,
    };

    // emit using socket (attached to req in index.js)
    try {
      if (req.io) {
        req.io.to(`user_${receiverId}`).emit("newMessage", emitted);
        req.io.to(`user_${senderId}`).emit("newMessage", emitted);
        req.io.to(`conv_${convId}`).emit("newMessage", emitted);
      }
    } catch (e) {
      console.warn("ChatController: emit failed", e.message);
    }

    res.json({ success: true, message: emitted });
  } catch (err) {
    console.error("sendMessageRest:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /api/chats/conversations
 * returns conversation summaries with unread counts and last message
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const uid = new mongoose.Types.ObjectId(String(userId));

    // Aggregate last message and unread counts per conversation
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
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiverId", uid] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
      { $limit: 200 },
    ]);

    const results = await Promise.all(
      conversations.map(async (c) => {
        const lastMsg = c.lastMessage;
        const parts = String(c._id).split("_");
        const otherId = parts.find((p) => p !== String(userId)) || parts[0];

        let otherUser = null;
        if (mongoose.Types.ObjectId.isValid(otherId)) {
          otherUser = await User.findById(otherId, "name email").lean();
        }

        return {
          _id: c._id,
          other: otherUser
            ? { _id: otherUser._id.toString(), name: otherUser.name, email: otherUser.email }
            : { _id: otherId, name: "User", email: null },
          lastMessage: {
            content: lastMsg.content,
            senderId: String(lastMsg.senderId),
            receiverId: String(lastMsg.receiverId),
            createdAt: lastMsg.createdAt,
            read: lastMsg.read,
          },
          updatedAt: c.updatedAt || lastMsg.createdAt,
          unreadCount: c.unreadCount || 0,
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
 * GET /api/chats/messages/:userId
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
