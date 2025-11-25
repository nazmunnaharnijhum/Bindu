// index.js
require("dotenv").config();
require("./Models/db"); // MongoDB connection

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const AuthRouter = require("./Routes/AuthRouter");
const AdminRouter = require("./Routes/AdminRouter");
const SmsController = require("./Controllers/SmsController");
const ScannerController = require("./Controllers/ScannerController");

const DonorRouter = require("./Routes/DonorRouter");
const ChatRouter = require("./Routes/ChatRouter");
const MessageModel = require("./Models/Message");

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// attach io to req so controllers can emit from REST endpoints
app.use((req, res, next) => {
  req.io = io;
  next();
});

// middlewares
app.use(bodyParser.json());
app.use(cors());

// static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/Ml_server/uploads", express.static(path.join(__dirname, "Ml_server/uploads")));

// routers
app.use("/auth", AuthRouter);
app.use("/admin", AdminRouter);
app.use("/api/donors", DonorRouter);
app.use("/api/chats", ChatRouter);

// scanner + SMS
app.post("/send-sms", SmsController.sendSms);
app.post("/create-temp-folder", ScannerController.createTempFolder);
app.post("/launch-scanner", ScannerController.launchFingerScanner);
app.post("/watch-fingerprint", ScannerController.watchForFingerprint);

// SOCKET.IO logic
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // authenticate socket with JWT token from client
  socket.on("authenticate", (data) => {
    try {
      if (!data || !data.token) throw new Error("No token provided");
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      socket.userId = decoded._id;
      console.log(`✅ Socket ${socket.id} authenticated as user ${socket.userId}`);

      // join personal room
      socket.join(`user_${socket.userId}`);
    } catch (err) {
      console.warn("⚠️ Socket authentication failed:", err.message);
      // notify client and disconnect
      try { socket.emit("unauthorized", { message: "Token expired or invalid" }); } catch (e) {}
      socket.disconnect(true);
    }
  });

  // join conversation room (optional helper)
  socket.on("joinConversation", ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conv_${conversationId}`);
      console.log(`📁 ${socket.id} joined conversation: ${conversationId}`);
    }
  });

  // receive messages emitted directly from clients (if you use socket send)
  socket.on("sendMessage", async (payload) => {
    try {
      const senderId = socket.userId;
      if (!senderId) return socket.emit("error", { message: "Not authenticated" });

      const { receiverId, content, meta } = payload || {};
      if (!receiverId || !content) return;

      const convId = [String(senderId), String(receiverId)].sort().join("_");

      // persist message
      const message = new MessageModel({
        conversationId: convId,
        senderId,
        receiverId,
        content,
        meta: meta || {},
      });

      await message.save();

      // populate sender's name for emitting
      await message.populate({ path: "senderId", select: "name email" });

      // canonical payload sent to clients
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

      // emit to recipient, sender and conversation room
      io.to(`user_${receiverId}`).emit("newMessage", emitted);
      io.to(`user_${senderId}`).emit("newMessage", emitted);
      io.to(`conv_${convId}`).emit("newMessage", emitted);
    } catch (err) {
      console.error("💥 sendMessage socket error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// global error handler (express)
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 Server running with WebSocket on port ${PORT}`));
