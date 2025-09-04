# Music Guessing Game

A simple multiplayer music guessing game built with Node.js, Express, and Socket.io.

## Features

- Real-time rooms where players compete to guess track titles.
- Points awarded based on the order of correct guesses.
- Each round lasts 20 seconds and there are five rounds per game.

## Setup

Install dependencies:

```bash
npm install
```

Start the server:

```bash
node server.js
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Project Structure

- `server.js` – Express/Socket.io server and game logic.
- `public/` – Static client files for the game and lobby.
- `songs/` – Audio tracks used during gameplay.

## Gameplay

Create or join a room, then guess the song title as clips play. The faster you guess correctly, the more points you earn.
After five rounds the player with the highest score wins.
