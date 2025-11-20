// ================= ENV + DB =================
require("dotenv").config();
require("./Models/db"); // MongoDB connection

// ================= CORE MODULES =================
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// ================= ROUTERS & CONTROLLERS =================
const AuthRouter = require("./Routes/AuthRouter");
const AdminRouter = require("./Routes/AdminRouter");
const SmsController = require("./Controllers/SmsController");
const ScannerController = require("./Controllers/ScannerController");

// New Features
const DonorRouter = require("./Routes/DonorRouter");
const ChatRouter = require("./Routes/ChatRouter");
const MessageModel = require("./Models/Message");

// ================= SOCKET.IO SETUP =================
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Attach io to req so routes/controllers can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ================= MIDDLEWARES =================
app.use(bodyParser.json());
app.use(cors());

// ================= STATIC FILES =================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/Ml_server/uploads", express.static(path.join(__dirname, "Ml_server/uploads")));

// ================= ROUTERS =================
app.use("/auth", AuthRouter);
app.use("/admin", AdminRouter);
app.use("/api/donors", DonorRouter); // donor system
app.use("/api/chats", ChatRouter);   // chat system

// ================= SCANNER + SMS APIs =================
app.post("/send-sms", SmsController.sendSms);
app.post("/create-temp-folder", ScannerController.createTempFolder);
app.post("/launch-scanner", ScannerController.launchFingerScanner);
app.post("/watch-fingerprint", ScannerController.watchForFingerprint);

// ================= SOCKET.IO LOGIC =================
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // Authenticate socket with JWT token
  socket.on("authenticate", (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      socket.userId = decoded._id;

      console.log(`✅ Socket ${socket.id} authenticated as user ${socket.userId}`);

      // Join user-specific room
      socket.join(`user_${socket.userId}`);
    } catch (err) {
  console.warn("⚠️ Socket authentication failed:", err.message);
  socket.emit("unauthorized", { message: "Token expired or invalid" });
  socket.disconnect(true);     // ❗ Disconnect the socket
  return;
}

  });

  // Join conversation room
  socket.on("joinConversation", ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conv_${conversationId}`);
      console.log(`📁 ${socket.id} joined conversation: ${conversationId}`);
    }
  });

  // Send Message
  socket.on("sendMessage", async (payload) => {
    try {
      const senderId = socket.userId;
      if (!senderId) {
        return socket.emit("error", { message: "Not authenticated" });
      }

      const { receiverId, content, meta } = payload;
      if (!receiverId || !content) return;

      // Unique conversation ID (sender + receiver)
      const convId = [senderId.toString(), receiverId.toString()]
        .sort()
        .join("_");

      // Save message
      const message = new MessageModel({
        conversationId: convId,
        senderId,
        receiverId,
        content,
        meta: meta || {},
      });

      await message.save();

      // Emit to both users + the room
      io.to(`user_${receiverId}`).emit("newMessage", message);
      io.to(`user_${senderId}`).emit("newMessage", message);
      io.to(`conv_${convId}`).emit("newMessage", message);

    } catch (err) {
      console.error("💥 sendMessage error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("Global Error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () =>
  console.log(`🚀 Server running with WebSocket on port ${PORT}`)
);
