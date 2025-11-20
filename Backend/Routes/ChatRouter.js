// Backend/Routes/ChatRouter.js
const express = require("express");
const router = express.Router();
const ChatController = require("../Controllers/ChatController");
const jwt = require("jsonwebtoken");

// Simple auth middleware using JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded._id, email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

router.post("/send", authenticateToken, ChatController.sendMessageRest);
router.get("/conversations", authenticateToken, ChatController.getConversations);
router.get("/messages/:userId", authenticateToken, ChatController.getMessages);

module.exports = router;
