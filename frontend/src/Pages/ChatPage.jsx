// frontend/src/Pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { initSocket, getSocket } from "../utils/socket";
import Footer from "../Components/Footer/Footer.jsx";
import Navbar from "../Components/Navbar/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";

const API = "http://localhost:8080/api";

export default function ChatPage() {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeOther, setActiveOther] = useState(null); // other user object
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const socketRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
  if (!token) return;

  const s = initSocket("http://localhost:8080", token);
  socketRef.current = s;

  const onNewMessage = (msg) => {
    const convId = [msg.senderId, msg.receiverId].sort().join("_");
    const localId = getLocalUserId();
    const activeConvId = activeOther
      ? [String(activeOther._id), localId].sort().join("_")
      : null;

    if (convId === activeConvId) {
      setMessages(prev => [...prev, msg]);
    } else {
      toast.info("New message received");
      fetchConversations();
    }
  };

  s.on("newMessage", onNewMessage);

  return () => {
    s.off("newMessage", onNewMessage);
  };
}, [token]);   // ❗ ONLY token


  useEffect(() => {
    if (!token) return;
    fetchConversations();
    // if url contains ?userId=..., open that conversation
    const params = new URLSearchParams(location.search);
    const userId = params.get("userId");
    const name = params.get("name");
    if (userId) {
      // create lightweight other user (will be replaced if conversation list has that user)
      openConversationWith({ _id: userId, name: name || "User" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function getLocalUserId() {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload._id;
    } catch {
      return null;
    }
  }

  async function fetchConversations() {
    try {
      const res = await axios.get(`${API}/chats/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setConversations(res.data.conversations || []);
    } catch (err) {
      console.error("fetchConversations:", err);
    }
  }

  async function openConversationWith(other) {
    setActiveOther(other);
    setMessages([]);
    try {
      const res = await axios.get(`${API}/chats/messages/${other._id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error("getMessages:", err);
    }
    // ask socket to join conv room (optional)
    const convId = [String(getLocalUserId()), String(other._id)].sort().join("_");
    const s = getSocket();
    if (s && s.emit) s.emit("joinConversation", { conversationId: convId });
  }

  async function handleSend() {
    if (!activeOther || !text.trim()) return;
    try {
      const res = await axios.post(`${API}/chats/send`, {
        receiverId: activeOther._id,
        content: text.trim()
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        // server will emit newMessage (we'll also append to local view for immediate feedback)
        setMessages(prev => [...prev, res.data.message]);
        setText("");
      } else {
        toast.error(res.data?.message || "Send failed");
      }
    } catch (err) {
      console.error("sendMessage error:", err);
      toast.error("Error sending message");
    }
  }

  return (
    <div>
      {/* <Navbar /> */}
      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[70vh]">
        {/* Conversations */}
        <div className="col-span-1 bg-[#561C24]/70 p-3 rounded border border-[#C7B7A3] overflow-auto">
          <h3 className="font-bold mb-2">Conversations</h3>
          <div className="space-y-2">
            {conversations.map(c => (
              <div key={c._id} className="p-2 rounded hover:bg-[#E8D8C4]/10 cursor-pointer"
                onClick={() => openConversationWith(c.other)}>
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">{c.other?.name}</div>
                    <div className="text-xs text-[#C7B7A3]">{c.lastMessage?.content?.slice(0,80)}</div>
                  </div>
                  <div className="text-xs">{new Date(c.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div className="col-span-2 bg-[#561C24]/70 p-4 rounded border border-[#C7B7A3] flex flex-col">
          {!activeOther ? (
            <div className="flex-1 flex items-center justify-center text-[#C7B7A3]">Select a conversation or click Message on a donor</div>
          ) : (
            <>
              <div className="mb-3">
                <div className="font-bold text-lg">{activeOther.name}</div>
                {activeOther.email && (
  <div className="text-xs text-[#C7B7A3]">{activeOther.email}</div>
)}

              </div>

              <div className="flex-1 overflow-auto space-y-3 p-2" style={{minHeight:200}}>
                {messages.map(m => (
                  <div key={m._id || m.createdAt} className={`max-w-[80%] p-2 rounded ${String(m.senderId) === String(getLocalUserId()) ? "ml-auto bg-[#E8D8C4] text-[#561C24]" : "bg-[#6A1E55] text-[#E8D8C4]"}`}>
                    <div className="text-sm">{m.content}</div>
                    <div className="text-xs text-gray-300 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} className="flex-1 p-2 rounded bg-transparent border border-[#C7B7A3]" placeholder="Type a message..." />
                <button onClick={handleSend} className="px-4 py-2 rounded bg-[#E8D8C4] text-[#561C24] font-semibold">Send</button>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
