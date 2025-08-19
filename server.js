const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require("uuid");
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.use(express.static('public'));

const io = new Server(server);

function roomSize(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    return room ? room.size : 0;
  }


io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on("createGame", (ack) => {
        const roomCode = uuidv4().slice(0, 6); // short unique code like "a1b2c3"
        socket.join(roomCode);                 // put this player in the room
        ack({ roomCode });                     // send back code to client
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
    });


    socket.on("joinGame", (roomCode, ack) => {
        const room = io.sockets.adapter.rooms.get(roomCode);
    
        if (!room) {
          return ack({ ok: false, error: "Room not found" });
        }
        if (room.size >= 4) { // max players
          return ack({ ok: false, error: "Room is full" });
        }
    
        socket.join(roomCode);
        ack({ ok: true, roomCode });
        io.to(roomCode).emit("msg", `${socket.id} joined ${roomCode}`);
      });
    
});
