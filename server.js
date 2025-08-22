const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require("uuid");
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const TRACKS = [
  { src: "/songs/flashing lights-kanye west Explicit version.mp3", name: "flashing lights" },
  { src: "/songs/kanye-west-heartless-128-ytshorts.savetube.me.mp3", name: "heartless" },
  { src: "/songs/kanye-west-runaway-video-version-ft-pusha-t-128-ytshorts.savetube.me.mp3", name: "runaway" }
];

const ROUND_DURATION_MS = 20000;
const TOTAL_ROUNDS = 5;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.use(express.static('public'));
app.use('/songs', express.static('songs'));

const io = new Server(server);

const rooms = Object.create(null);
function ensureRoom(code) {
  if (!rooms[code]) rooms[code] = {
    users: new Map(),
    round: null,
    roundCount: 0,
    roundTimer: null,
    creatorId: null,
  };
  return rooms[code];
}
function broadcastRoster(io, code) {
  const room = rooms[code];
  if (!room) return;
  const roster = Array.from(room.users.values()).sort((a, b) => b.points - a.points);
  io.to(code).emit('roster', roster);
}

function endRound(code) {
  const room = rooms[code];
  if (!room || !room.round) return;

  clearTimeout(room.roundTimer);
  room.roundTimer = null;

  const trackName = room.round.track.name;
  const scoreboard = Array.from(room.users.values()).sort((a, b) => b.points - a.points);

  io.to(code).emit('roundEnd', { trackName, scoreboard });
  broadcastRoster(io, code);

  room.round = null;

  if (room.roundCount >= TOTAL_ROUNDS) {
    io.to(code).emit('gameEnd', scoreboard);
  }
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
      if (!room.creatorId) room.creatorId = socket.id;
      // store minimal identity; you can add avatar, score, etc.
      const display = name?.trim() || `Player-${socket.id.slice(0,4)}`;
      room.users.set(socket.id, { id: socket.id, name: display, points: 0 });

      ack?.({
        ok: true,
        roomCode: code,
        me: { id: socket.id, name: display, points: 0 },
        isCreator: socket.id === room.creatorId,
      });
      broadcastRoster(io, code);
    });

    socket.on('startRound', (code) => {
      const room = rooms[code];
      if (!room) return;
      if (socket.id !== room.creatorId) return;
      const track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
      room.round = { track, guesses: [] };
      room.roundCount = (room.roundCount || 0) + 1;
      if (room.roundTimer) clearTimeout(room.roundTimer);
      room.roundTimer = setTimeout(() => endRound(code), ROUND_DURATION_MS);
      io.to(code).emit('roundStart', {
        track: { src: track.src },
        round: room.roundCount,
        totalRounds: TOTAL_ROUNDS,
        duration: ROUND_DURATION_MS,
      });
    });

    socket.on('guess', ({ code, guess }) => {
      const room = rooms[code];
      if (!room?.round) return;
      const normalized = guess?.trim().toLowerCase();
      if (normalized !== room.round.track.name.toLowerCase()) return;
      if (room.round.guesses.find(g => g.id === socket.id)) return;
      const entry = { id: socket.id, timestamp: Date.now() };
      room.round.guesses.push(entry);
      const pointsTable = [1000, 700, 400, 200];
      const idx = room.round.guesses.length - 1;
      const pointsAwarded = pointsTable[idx] || 0;
      const user = room.users.get(socket.id);
      if (user) user.points = (user.points || 0) + pointsAwarded;
      io.to(code).emit('correctGuess', { playerId: socket.id, pointsAwarded });
      broadcastRoster(io, code);
      if (room.round.guesses.length >= room.users.size) {
        endRound(code);
      }
    });

    socket.on('addPoints', ({ code, points }) => {
      const room = rooms[code];
      if (!room) return;
      const u = room.users.get(socket.id);
      if (!u) return;
      u.points = (u.points || 0) + (points || 0);
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
