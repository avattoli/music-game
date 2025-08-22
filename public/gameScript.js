document.addEventListener('DOMContentLoaded', () => {
    const formInput = document.getElementById('formInput');
    const countdown = document.getElementById('countdown');
    const mute = document.getElementById('mute');
    const points = document.getElementById('points');
    const startBtn = document.getElementById("startBtn");
    const nextBtn = document.getElementById("next");
    const gameArea = document.getElementById('gameArea');
    let myId = null;
    let timeLeft;
    let interval;
    let trackIndex;
    let currentSong = null;
    const tracks = [
        {src: "../songs/flashing lights-kanye west Explicit version.mp3", name: "flashing lights"},
        {src: "../songs/kanye-west-heartless-128-ytshorts.savetube.me.mp3", name: "heartless"},
        {src: "../songs/kanye-west-runaway-video-version-ft-pusha-t-128-ytshorts.savetube.me.mp3", name: "runaway"}
    ];

    const socket = io();
    const usersUl = document.getElementById('users');
    const code = new URLSearchParams(location.search).get('roomCode');
    if (!code) { alert('Missing room code'); location.href = '/'; return; }
  
    const name = prompt('Your name (optional):') || '';
  
    socket.emit('joinGame', { code, name }, (res) => {
      if (!res.ok) { alert(res.error); location.href = '/'; return; }
      myId = res.me.id;
      points.textContent = res.me.points;
    });
  
    socket.on('roster', (roster) => {
      // roster is [{id,name,points}, ...] for this room
      usersUl.innerHTML = '';
      const sorted = [...roster].sort((a,b) => b.points - a.points);
      for (const u of sorted) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${u.name}</span><span>${u.points}</span>`;
        usersUl.appendChild(li);
      }
      const me = roster.find(u => u.id === myId);
      if (me) points.textContent = me.points;
    });
  
    // Stop any currently playing song and clean up
    function stopCurrentSong() {
        if (currentSong) {
            currentSong.pause();
            currentSong.currentTime = 0;
            currentSong = null;
        }
    }

    startBtn.addEventListener('click', () => {
        startBtn.style.display = "none";
        gameArea.style.display = "flex";
        startGame();
    });

    mute.addEventListener('click', () => {
        if (currentSong.volume === 0) {
            currentSong.volume = 0.5;
            mute.textContent = 'Mute';
        } else {
            currentSong.volume = 0;
            mute.textContent = 'Unmute';
        }
    });


    function startGame() {
        // Stop any currently playing song
        stopCurrentSong();
        const userInput = document.getElementById('userInput');
        userInput.disabled = false;
        userInput.focus();
        mute.style.display = "block";
        // Clear any existing interval
        if (interval) {
            clearInterval(interval);
        }
        
        timeLeft = 20;
        trackIndex = Math.floor(Math.random() * tracks.length);
        
        // Create and play new song
        currentSong = new Audio(tracks[trackIndex].src);
        currentSong.volume = 0.5;
        currentSong.name = "song";
        
        // Handle play promise
        const playPromise = currentSong.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Audio playback failed:", error);
            });
        }
        
        // Update countdown every second
        interval = setInterval(() => {
            timeLeft--;
            countdown.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                handleTimeUp();
            }
        }, 1000);


        // Clear any existing form submission handlers to prevent duplicates
        const newForm = formInput.cloneNode(true);
        formInput.parentNode.replaceChild(newForm, formInput);
        
        // Add form submission handler
        newForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const userInput = event.target.userInput;
            if (userInput.value.trim().toLowerCase() === tracks[trackIndex].name) {
                handleCorrectGuess();
            }
            userInput.value = ''; // Clear input after submission
        });

        // Handle correct guess
        function handleCorrectGuess() {
            clearInterval(interval);
            stopCurrentSong();
            
            const timeTaken = 20 - timeLeft;
            const pointsToAdd = getScore(timeTaken);
            const totalPoints = parseInt(points.textContent) + pointsToAdd;

            countdown.textContent = `Correct! +${pointsToAdd} points!`;
            points.textContent = totalPoints;
            socket.emit('addPoints', { code, points: pointsToAdd });
            nextBtn.style.display = "block";
            mute.style.display = "none";
        }

        // Handle time up
        function handleTimeUp() {
            stopCurrentSong();
            countdown.textContent = "Time's up!";
            nextBtn.style.display = "block";
            document.getElementById('userInput').disabled = true;
        }

        // Set up next button
        nextBtn.addEventListener('click', () => {
            nextBtn.style.display = "none";
            newForm.userInput.value = ''; // Clear input field
            startGame();
        });

        // Calculate score based on time taken
        function getScore(timeTaken) {
            if (timeTaken <= 3) {
                return 1000;
            } else {
                return Math.max(100, 1000 - 100 * (timeTaken - 3));
            }
        }
          
    }
});