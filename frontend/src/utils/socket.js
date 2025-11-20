// frontend/src/utils/socket.js
import { io } from "socket.io-client";

let socket = null;

/**
 * initSocket(token)
 * - creates the singleton socket if not exists, connects, authenticates with token.
 * - returns the socket instance.
 */
export function initSocket(baseUrl = "http://localhost:8080", token) {
  if (socket) {
    // if already connected but token changed, re-auth
    if (token && socket.connected) socket.emit("authenticate", { token });
    return socket;
  }

  socket = io(baseUrl, {
    autoConnect: false,
    transports: ["websocket", "polling"],
  });

  // optional logs
  socket.on("connect", () => console.log("socket.js: Socket connected:", socket.id));
  socket.on("disconnect", () => console.log("socket.js: Socket disconnected:", socket.id));

  // connect and authenticate if token provided
  socket.connect();
  if (token) socket.emit("authenticate", { token });

  return socket;
}

/** getSocket() - returns the singleton (may be null) */
export function getSocket() {
  return socket;
}

/** closeSocket() - disconnect and remove singleton */
export function closeSocket() {
  if (socket) {
    try { socket.disconnect(); } catch (e) { /* noop */ }
    socket = null;
  }
}
