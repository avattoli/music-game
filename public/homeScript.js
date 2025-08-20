const socket = io();

const input = document.getElementById('msg');
const button = document.getElementById('send');
const out = document.getElementById('out');

button.addEventListener('click', () => {
    socket.emit('guess', input.value);
    input.value = '';
});

socket.on('guess', (guess) => {
    out.textContent = guess;
});

document.getElementById("createBtn").onclick = () => {
    socket.emit("createGame", ({ roomCode }) => {
      console.log("Created room:", roomCode);
      alert(`Share this code with your friends: ${roomCode}`);
      window.location.href = 'game.html?roomCode=' + roomCode;
    });
};

document.getElementById("joinBtn").onclick = () => {
  const code = prompt("Enter room code:")?.trim();
  if (!code) return;
  window.location.href = 'game.html?roomCode=' + encodeURIComponent(code);
};

  