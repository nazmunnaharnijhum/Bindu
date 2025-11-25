// Backend/Models/Message.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  conversationId: { type: String, required: true }, // stable id: sorted userId strings joined by _
  senderId: { type: Schema.Types.ObjectId, ref: "users", required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: "users", required: true },
  content: { type: String, required: true },
  meta: { type: Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
