// card_server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

let roomCode = generateCode();
let players = {}; // { socketId: { nickname, score, combo } }

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function loadCardPairs() {
  const data = fs.readFileSync("public/data/connect-game.json", "utf-8");
  return JSON.parse(data);
}

function generateShuffledTiles() {
  const allPairs = loadCardPairs();
  const sample = shuffle(allPairs).slice(0, 15);
  return shuffle(sample.flatMap(pair => pair.items.map(i => ({
    ...i,
    pairId: pair.pairId
  }))));
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

io.on("connection", (socket) => {
  console.log("✅ 연결됨:", socket.id);

  socket.on("join", ({ nickname }) => {
    players[socket.id] = { nickname, score: 0, combo: 0 };
    socket.join(roomCode);
    console.log(`🙋 ${nickname} 참가 (방: ${roomCode})`);

    // 카드쌍 전송
    const tiles = generateShuffledTiles();
    socket.emit("startGame", tiles);
  });

  socket.on("checkMatch", ({ tile1, tile2 }) => {
    const isMatch = tile1.pairId === tile2.pairId && tile1.id !== tile2.id;
    if (isMatch) {
      players[socket.id].score += 10;
      players[socket.id].combo++;
      socket.emit("matchResult", { correct: true, score: players[socket.id].score });
    } else {
      players[socket.id].combo = 0;
      socket.emit("matchResult", { correct: false });
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    console.log("❌ 연결 종료:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 카드맞추기 서버 실행 중: http://localhost:${PORT}`);
});
