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

const rooms = Object.create(null); 
function ensureRoom(code) {
  if (!rooms[code]) rooms[code] = { users: new Map() };
  return rooms[code];
}
function broadcastRoster(io, code) {
  const room = rooms[code];
  if (!room) return;
  const roster = Array.from(room.users.values()); // [{id,name}, ...]
  io.to(code).emit('roster', roster);
}

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on("createGame", (ack) => {
      const roomCode = uuidv4().slice(0, 6);
      ack({ ok: true, roomCode });
    });

    socket.on("size", (roomCode, ack) => {
      const room = io.sockets.adapter.rooms.get(roomCode);
      const size = room ? room.size : 0;
      ack(size);
    });
    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
    });

    socket.on("redirect", (roomCode, ack) => {
      const room = io.sockets.adapter.rooms.get(roomCode);
      if (room) {
        console.log("redirected to", roomCode);
        ack({ ok: true, roomCode });
      } else {
        ack({ ok: false, error: "Room not found" });
      }
    })

    socket.on('joinGame', ({ code, name }, ack) => {
      if (!code) return ack?.({ ok: false, error: 'Missing code' });
      const roomSize = io.sockets.adapter.rooms.get(code)?.size || 0;
      if (roomSize >= 4) return ack?.({ ok: false, error: 'Room is full' });
  
      socket.join(code);
      const room = ensureRoom(code);
      // store minimal identity; you can add avatar, score, etc.
      const display = name?.trim() || `Player-${socket.id.slice(0,4)}`;
      room.users.set(socket.id, { id: socket.id, name: display });
  
      ack?.({ ok: true, roomCode: code, me: { id: socket.id, name: display } });
      broadcastRoster(io, code);
    });

    socket.on('setName', ({ code, name }) => {
      const room = rooms[code];
      if (!room) return;
      const u = room.users.get(socket.id);
      if (!u) return;
      u.name = name?.trim() || u.name;
      broadcastRoster(io, code);
    });
    
    socket.on('leaveGame', (code) => {
      const room = rooms[code];
      socket.leave(code);
      if (room) {
        room.users.delete(socket.id);
        if (room.users.size === 0) delete rooms[code];
        else broadcastRoster(io, code);
      }
    });

    socket.on('disconnecting', () => {
      // socket.rooms includes socket.id; filter real rooms only
      for (const code of socket.rooms) {
        const room = rooms[code];
        if (!room) continue;
        room.users.delete(socket.id);
        if (room.users.size === 0) delete rooms[code];
        else broadcastRoster(io, code);
      }
    });
    
});
