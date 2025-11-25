import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { initSocket, getSocket } from "../utils/socket";
import Footer from "../Components/Footer/Footer.jsx";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

const API = "http://localhost:8080/api";

export default function ChatPage() {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeOther, setActiveOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  function getLocalUserId() {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload._id;
    } catch {
      return null;
    }
  }

  // Init socket once
  useEffect(() => {
    if (!token) return;

    const s = initSocket("http://localhost:8080", token);
    socketRef.current = s;

    const onNewMessage = (msg) => {
      const localId = getLocalUserId();
      const convId = [msg.senderId, msg.receiverId].sort().join("_");

      const activeConvId = activeOther
        ? [String(activeOther._id), localId].sort().join("_")
        : null;

      if (activeConvId && convId === activeConvId) {
        setMessages((prev) => [...prev, msg]);
        fetchConversations();
      } else {
        fetchConversations();

        const senderName = msg.senderName || "User";
        toast.info(
          <div
            className="cursor-pointer"
            onClick={() => {
              const other = { _id: msg.senderId, name: senderName };
              openConversationWith(other);
            }}
          >
            <strong>{senderName}</strong>: {String(msg.content).slice(0, 50)}
          </div>,
          { autoClose: 4000 }
        );
      }
    };

    s.on("newMessage", onNewMessage);
    return () => s.off("newMessage", onNewMessage);
  }, [token, activeOther]);

  useEffect(() => {
    if (token) fetchConversations();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchConversations() {
    try {
      const res = await axios.get(`${API}/chats/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setConversations(res.data.conversations);
    } catch (err) {
      console.error("fetchConversations", err);
    }
  }

  async function openConversationWith(other) {
    setActiveOther(other);
    setMessages([]);

    try {
      const res = await axios.get(`${API}/chats/messages/${other._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        setMessages(res.data.messages);
        fetchConversations();
      }
    } catch (err) {
      console.error("getMessages", err);
    }

    const convId = [String(getLocalUserId()), String(other._id)]
      .sort()
      .join("_");

    const s = getSocket();
    if (s) s.emit("joinConversation", { conversationId: convId });
  }

  async function handleSend() {
    if (!activeOther || !text.trim()) return;

    try {
      const res = await axios.post(
        `${API}/chats/send`,
        {
          receiverId: activeOther._id,
          content: text.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        setMessages((prev) => [...prev, res.data.message]);
        setText("");
        fetchConversations();
      }
    } catch (err) {
      console.error("sendMessage err", err);
      toast.error("Failed to send message");
    }
  }

  return (
    <div className="flex min-h-[80vh] h-full max-w-6xl mx-auto mt-4 border rounded overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-80 bg-[#561C24] text-[#E8D8C4] p-4 overflow-auto">
        <h2 className="text-xl font-bold mb-4">Conversations</h2>

        {conversations.length === 0 && (
          <div className="text-sm text-[#C7B7A3]">No conversations yet</div>
        )}

        <div className="space-y-2">
          {conversations.map((c) => {
            console.log("CONVERSATION OBJECT:", c);

            const isActive =
              activeOther &&
              String(activeOther._id) === String(c.other._id);

            return (
              <div
                key={c._id}
                onClick={() => openConversationWith(c.other)}
                className={`p-3 rounded cursor-pointer flex justify-between hover:bg-[#E8D8C4]/10 ${
                  isActive ? "bg-[#E8D8C4]/10" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <div className="font-semibold truncate">
                      {c.other?.name || "User"}
                    </div>
                    <div className="text-xs text-[#C7B7A3] ml-2">
                      {new Date(c.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  <div className="text-sm text-[#C7B7A3] truncate max-w-[180px]">
                    <span
                      className={
                        c.unreadCount > 0 ? "font-bold text-white" : ""
                      }
                    >
                      {c.lastMessage?.content || ""}
                    </span>
                  </div>
                </div>

                {c.unreadCount > 0 && (
                  <div className="ml-2">
                    <span className="bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
                      {c.unreadCount > 99 ? "99+" : c.unreadCount}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT CHAT WINDOW */}
      <div className="flex-1 bg-[#2C0E37] text-[#E8D8C4] p-4 flex flex-col">
        {/* Chat header + messages */}
        {activeOther ? (
          <>
            <h3 className="text-lg font-bold mb-1">{activeOther.name}</h3>

            <div className="flex-1 overflow-auto mb-4 space-y-3 px-2">
              {messages.map((m) => {
                const mine = String(m.senderId) === String(getLocalUserId());
                return (
                  <div
                    key={m._id || m.createdAt}
                    className={`max-w-[70%] p-3 rounded break-words leading-relaxed shadow-md ${
                      mine
                        ? "ml-auto bg-[#E8D8C4] text-[#561C24] rounded-br-none"
                        : "mr-auto bg-[#561C24]/80 text-[#E8D8C4] rounded-bl-none"
                    }`}
                  >
                    <div>{m.content}</div>
                    <div className="text-xs text-[#C7B7A3] mt-1">
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#C7B7A3]">
            Select a conversation
          </div>
        )}

        {/* INPUT BAR — ALWAYS VISIBLE */}
        <div className="flex gap-2 mt-2">
          <input
            value={text}
            disabled={!activeOther}
            onChange={(e) => setText(e.target.value)}
            className={`flex-1 p-2 rounded border ${
              activeOther
                ? "bg-[#561C24]/60 border-[#C7B7A3]"
                : "bg-gray-700 border-gray-500 text-gray-400 cursor-not-allowed"
            }`}
            placeholder={
              activeOther
                ? "Type a message..."
                : "Select a conversation to start chatting"
            }
            onKeyDown={(e) => e.key === "Enter" && activeOther && handleSend()}
          />
          <button
            disabled={!activeOther}
            onClick={handleSend}
            className={`px-4 py-2 rounded transition ${
              activeOther
                ? "bg-[#E8D8C4] text-[#561C24] hover:bg-[#e4ccb0]"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
