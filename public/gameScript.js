document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formInput');
  const userInput = document.getElementById('userInput');
  const countdown = document.getElementById('countdown');
  const mute = document.getElementById('mute');
  const points = document.getElementById('points');
  const startBtn = document.getElementById('startBtn');
  const nextBtn = document.getElementById('next');
  const gameArea = document.getElementById('gameArea');
  const roundInfo = document.getElementById('roundInfo');
  const gameOverModal = document.getElementById('gameOverModal');
  const winnerMessage = document.getElementById('winnerMessage');
  const playAgain = document.getElementById('playAgain');
  const usersUl = document.getElementById('users');

  const socket = io();

  const code = new URLSearchParams(location.search).get('roomCode');
  if (!code) { alert('Missing room code'); location.href = '/'; return; }
  const name = prompt('Your name (optional):') || '';

  let myId = null;
  let currentSong = null;
  let interval = null;
  let timeLeft = 0;
  let isCreator = false;

  socket.emit('joinGame', { code, name }, (res) => {
    if (!res.ok) { alert(res.error); location.href = '/'; return; }
    myId = res.me.id;
    points.textContent = res.me.points;
    isCreator = !!res.isCreator;
    if (!isCreator) startBtn.style.display = 'none';
  });

  socket.on('roster', (roster) => {
    usersUl.innerHTML = '';
    for (const u of roster) {
      const li = document.createElement('li');
      li.dataset.id = u.id;
      li.innerHTML = `<span>${u.name}</span><span>${u.points}</span>`;
      usersUl.appendChild(li);
    }
    const me = roster.find(u => u.id === myId);
    if (me) points.textContent = me.points;
  });

  function stopCurrentSong() {
    if (currentSong) {
      currentSong.pause();
      currentSong.currentTime = 0;
      currentSong = null;
    }
  }

  startBtn.addEventListener('click', () => {
    if (!isCreator) return;
    startBtn.style.display = 'none';
    gameArea.style.display = 'flex';
    socket.emit('startRound', code);
  });

  nextBtn.addEventListener('click', () => {
    nextBtn.style.display = 'none';
    if (isCreator) socket.emit('startRound', code);
  });

  mute.addEventListener('click', () => {
    if (!currentSong) return;
    if (currentSong.volume === 0) {
      currentSong.volume = 0.5;
      mute.textContent = 'Mute';
    } else {
      currentSong.volume = 0;
      mute.textContent = 'Unmute';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const guess = userInput.value;
    socket.emit('guess', { code, guess });
    userInput.value = '';
  });

  socket.on('roundStart', ({ track, round, totalRounds, duration }) => {
    stopCurrentSong();
    gameArea.style.display = 'flex';
    userInput.disabled = false;
    mute.style.display = 'block';
    roundInfo.textContent = `Round ${round}/${totalRounds}`;
    timeLeft = Math.floor(duration / 1000);
    countdown.textContent = timeLeft;
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      timeLeft--;
      countdown.textContent = timeLeft;
      if (timeLeft <= 0) clearInterval(interval);
    }, 1000);
    currentSong = new Audio(track.src);
    currentSong.volume = 0.5;
    const p = currentSong.play();
    if (p !== undefined) p.catch(err => console.error('Audio playback failed:', err));
  });

  socket.on('correctGuess', ({ playerId, pointsAwarded }) => {
    const li = usersUl.querySelector(`li[data-id="${playerId}"]`);
    if (li) {
      li.classList.add('flash');
      setTimeout(() => li.classList.remove('flash'), 1000);
    }
    if (playerId === myId) {
      countdown.textContent = `Correct! +${pointsAwarded}`;
      userInput.disabled = true;
      points.textContent = String(Number(points.textContent) + pointsAwarded);
    } else {
      countdown.textContent = 'Another player guessed correctly!';
    }
  });

  socket.on('roundEnd', ({ trackName, scoreboard }) => {
    stopCurrentSong();
    if (interval) clearInterval(interval);
    countdown.textContent = `Answer: ${trackName}`;
    userInput.disabled = true;
    nextBtn.style.display = isCreator ? 'block' : 'none';
    mute.style.display = 'none';
    if (scoreboard) {
      usersUl.innerHTML = '';
      scoreboard.forEach((u) => {
        const li = document.createElement('li');
        li.dataset.id = u.id;
        li.innerHTML = `<span>${u.name}</span><span>${u.points}</span>`;
        usersUl.appendChild(li);
      });
    }
  });

  socket.on('gameEnd', (scoreboard) => {
    stopCurrentSong();
    if (interval) clearInterval(interval);
    countdown.textContent = 'Game over!';
    userInput.disabled = true;
    nextBtn.style.display = 'none';
    mute.style.display = 'none';
    usersUl.innerHTML = '';
    scoreboard.forEach((u, idx) => {
      const li = document.createElement('li');
      li.dataset.id = u.id;
      li.innerHTML = `<span>${u.name}</span><span>${u.points}</span>`;
      if (idx === 0) li.classList.add('winner');
      usersUl.appendChild(li);
    });
    const winner = scoreboard[0];
    if (winner) {
      winnerMessage.textContent = `${winner.name} wins with ${winner.points} points!`;
      gameOverModal.classList.remove('hidden');
    }
  });

  playAgain.addEventListener('click', () => {
    location.href = '/';
  });
});
