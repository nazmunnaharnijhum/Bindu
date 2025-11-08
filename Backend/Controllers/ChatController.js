// Backend/Controllers/ChatController.js
const Message = require("../Models/Message");
const User = require("../Models/User");

// helper to create conversationId from two user ids (stable order)
const conversationIdFor = (a, b) => {
  const [u1, u2] = [a.toString(), b.toString()].sort();
  return `${u1}_${u2}`;
};

// Save message (used by socket events and REST fallback)
const saveMessage = async ({ senderId, receiverId, content, meta }) => {
  const conversationId = conversationIdFor(senderId, receiverId);
  const msg = new Message({
    conversationId,
    senderId,
    receiverId,
    content,
    meta: meta || {},
  });
  await msg.save();
  return msg;
};

// REST: get messages between two users
const getConversation = async (req, res) => {
  try {
    const { withUserId } = req.query;
    if (!withUserId) return res.status(400).json({ success: false, message: "withUserId required" });
    const userId = req.user._id;
    const conversationId = conversationIdFor(userId, withUserId);
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    console.error("getConversation:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// REST: get contacts (last message preview)
const getContacts = async (req, res) => {
  try {
    const userId = req.user._id;
    // get distinct conversationIds where user is sender or receiver
    const msgs = await Message.aggregate([
      { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    // simplify and include contact id
    const contacts = msgs.map((m) => {
      const last = m.lastMessage;
      const otherId = last.senderId.toString() === userId.toString() ? last.receiverId : last.senderId;
      return {
        conversationId: m._id,
        lastMessage: {
          content: last.content,
          createdAt: last.createdAt,
          senderId: last.senderId,
        },
        contactId: otherId,
      };
    });

    res.json({ success: true, contacts });
  } catch (err) {
    console.error("getContacts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { saveMessage, getConversation, getContacts, conversationIdFor };
