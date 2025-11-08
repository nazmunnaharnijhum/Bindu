// frontend/src/Pages/Chat.jsx
import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL) ? import.meta.env.VITE_SOCKET_URL : "";

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem("token") || "");
  const [userId, setUserId] = useState(null);
  const [peerId, setPeerId] = useState(""); // other user id to chat with
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const messagesRef = useRef();

  useEffect(() => {
    // create socket connection
    const s = io(undefined, { autoConnect: false }); // will connect manually
    setSocket(s);

    // cleanup
    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    // connect
    socket.connect();

    socket.on("connect", () => {
      // authenticate immediately
      if (authToken) {
        socket.emit("authenticate", { token: authToken });
      }
    });

    socket.on("newMessage", (msg) => {
      setMessages((m) => [...m, msg]);
    });

    socket.on("disconnect", () => {
      console.log("socket disconnected");
    });

    return () => {
      socket.off("newMessage");
    };
  }, [socket, authToken]);

  // load conversation via REST
  const loadConversation = async () => {
    if (!peerId) return alert("Enter Peer User ID to load conversation");
    try {
      const res = await axios.get(`/api/messages/conversation?withUserId=${peerId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setMessages(res.data.messages || []);
      // join conversation room
      const convId = [res?.data?.messages?.[0]?.senderId, res?.data?.messages?.[0]?.receiverId].filter(Boolean).sort().join("_");
      if (socket && peerId) {
        const conversationId = [peerId, getMyIdFromToken(authToken)].sort().join("_");
        socket.emit("joinConversation", { conversationId });
      }
    } catch (err) {
      console.error("loadConversation", err);
      alert("Failed to load conversation. Make sure you are logged in and peerId is correct.");
    }
  };

  const sendMessage = async () => {
    if (!peerId) return alert("Enter Peer User ID");
    if (!text.trim()) return;
    if (!socket) return;

    socket.emit("sendMessage", { receiverId: peerId, content: text });
    setText("");
  };

  // helper to extract userId from token (not secure, just for UI)
  function getMyIdFromToken(token) {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload._id || payload.id || null;
    } catch (err) {
      return null;
    }
  }

  useEffect(() => {
    setUserId(getMyIdFromToken(authToken));
  }, [authToken]);

  useEffect(() => {
    // scroll bottom
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="min-h-screen bg-[#f7efe9] p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-semibold mb-4">Real-time Chat</h2>
        <div className="mb-4 flex gap-2">
          <input
            placeholder="Peer userId (enter the other user's id)"
            value={peerId}
            onChange={(e) => setPeerId(e.target.value)}
            className="border p-2 rounded flex-1"
          />
          <button onClick={loadConversation} className="bg-[#6D2932] text-white px-4 py-2 rounded">
            Load
          </button>
        </div>

        <div ref={messagesRef} className="h-72 overflow-y-auto border rounded p-3 mb-3">
          {messages.length === 0 ? (
            <div className="text-gray-500">No messages</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === userId || (m.senderId?._id === userId);
              return (
                <div key={m._id || Math.random()} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`p-2 rounded-lg ${mine ? "bg-[#E8D8C4]" : "bg-gray-100"}`}>
                    <div className="text-sm">{m.content}</div>
                    <div className="text-xs text-gray-500 mt-1">{new Date(m.createdAt || m.created_at).toLocaleString()}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 border p-2 rounded"
            placeholder="Type a message"
          />
          <button onClick={sendMessage} className="bg-[#6D2932] text-white px-4 py-2 rounded">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
