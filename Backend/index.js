// ✅ Backend/index.js (Updated & Optimized)
require("dotenv").config();
require("./Models/db"); // MongoDB connection

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

// Routers & Controllers
const AuthRouter = require("./Routes/AuthRouter");
const AdminRouter = require("./Routes/AdminRouter");
const SmsController = require("./Controllers/SmsController");
const ScannerController = require("./Controllers/ScannerController");

// 🩸 New features
const DonorRouter = require("./Routes/DonorRouter");
const ChatRouter = require("./Routes/ChatRouter");
const MessageModel = require("./Models/Message");

const app = express();
const server = http.createServer(app);

// ✅ Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*", // change this to your frontend URL in production
    methods: ["GET", "POST"],
  },
});

// ✅ Attach io to every request (for real-time donor updates, chat, etc.)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ✅ Middlewares
app.use(bodyParser.json());
app.use(cors());

// ✅ Static file hosting
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/Ml_server/uploads", express.static(path.join(__dirname, "Ml_server/uploads")));

// ✅ Routers
app.use("/auth", AuthRouter);
app.use("/admin", AdminRouter);
app.use("/api/donors", DonorRouter); // donor system
app.use("/api/messages", ChatRouter); // chat system

// ✅ Basic controllers
app.post("/send-sms", SmsController.sendSms);
app.post("/create-temp-folder", ScannerController.createTempFolder);
app.post("/launch-scanner", ScannerController.launchFingerScanner);
app.post("/watch-fingerprint", ScannerController.watchForFingerprint);

// ✅ Socket.IO Logic
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // Authenticate socket using JWT
  socket.on("authenticate", (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      socket.userId = decoded._id;
      console.log(`✅ Socket ${socket.id} authenticated as ${socket.userId}`);

      // Join a personal room
      socket.join(`user_${socket.userId}`);
    } catch (err) {
      console.warn("⚠️ Socket authentication failed:", err.message);
    }
  });

  // Join a conversation room
  socket.on("joinConversation", ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conv_${conversationId}`);
      console.log(`🗂️ ${socket.id} joined conversation ${conversationId}`);
    }
  });

  // Handle new messages
  socket.on("sendMessage", async (payload) => {
    try {
      const senderId = socket.userId;
      if (!senderId) {
        return socket.emit("error", { message: "Not authenticated" });
      }

      const { receiverId, content, meta } = payload;
      if (!receiverId || !content) return;

      const convId = [senderId.toString(), receiverId.toString()].sort().join("_");

      // Save message
      const message = new MessageModel({
        conversationId: convId,
        senderId,
        receiverId,
        content,
        meta: meta || {},
      });
      await message.save();

      // Emit to both participants + conversation room
      io.to(`user_${receiverId}`).emit("newMessage", message);
      io.to(`user_${senderId}`).emit("newMessage", message);
      io.to(`conv_${convId}`).emit("newMessage", message);
    } catch (err) {
      console.error("💥 socket sendMessage error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ✅ Global error handler (optional best practice)
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ✅ Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server with WebSocket running on port ${PORT}`);
});
