// Backend/Routes/ChatRouter.js
const express = require("express");
const router = express.Router();
const ChatController = require("../Controllers/ChatController");

// This router assumes req.user is set by token middleware used elsewhere (AuthRouter uses its own authenticateToken).
// For simplicity we'll require token here via header verification middleware similar to RoleAuth but more permissive:
const jwt = require("jsonwebtoken");
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

router.get("/conversation", authenticate, ChatController.getConversation);
router.get("/contacts", authenticate, ChatController.getContacts);

module.exports = router;
