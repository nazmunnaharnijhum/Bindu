// frontend/src/utils/socket.js
import { io } from "socket.io-client";

let socket = null;

/**
 * initSocket(baseUrl, token)
 * - creates the singleton socket if not exists, connects, authenticates with token.
 */
export function initSocket(baseUrl = "http://localhost:8080", token) {
  if (socket) {
    // re-auth if token changed and socket is connected
    if (token && socket.connected) socket.emit("authenticate", { token });
    return socket;
  }

  socket = io(baseUrl, {
    autoConnect: false,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => console.log("socket.js: Socket connected:", socket.id));
  socket.on("disconnect", () => console.log("socket.js: Socket disconnected:", socket.id));
  socket.on("connect_error", (err) => console.warn("socket.js: connect_error", err && err.message));

  // connect and authenticate (if token provided)
  socket.connect();
  if (token) socket.emit("authenticate", { token });

  return socket;
}

export function getSocket() {
  return socket;
}

export function closeSocket() {
  if (socket) {
    try { socket.disconnect(); } catch (e) { /* noop */ }
    socket = null;
  }
}
