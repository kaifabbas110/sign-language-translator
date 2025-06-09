// server.js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    // origin: "http://localhost:5173",
    origin: '*',
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  socket.emit("me", socket.id);

  socket.on("disconnect", () => {
    socket.broadcast.emit("callEnded");
  });

  socket.on("callUser", (data) => {
    console.log("Receiving a call from:", data.from);
    console.log("Receiving a call from data:", data);

    io.to(data.userToCall).emit("callUser", {
      signal: data.signalData,
      from: data.from,
    });
  });

  socket.on("answerCall", (data) => {
    console.log("Call accepted, signaling back...");

    io.to(data.to).emit("callAccepted", data.signal);
  });
});

server.listen(5002, () => console.log("server is running on port 5002"));
