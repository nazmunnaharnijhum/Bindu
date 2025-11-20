// Backend/Models/Conversation.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const conversationSchema = new Schema({
  participants: [{ type: Schema.Types.ObjectId, ref: "users", required: true }],
  lastMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
}, { timestamps: true });

module.exports = mongoose.model("Conversation", conversationSchema);
