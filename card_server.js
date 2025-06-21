const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",  // 또는 ["http://127.0.0.1:5500"]
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: false
  }
});


// ✅ 입장 코드 및 참가자 목록
let roomCode = generateCode();
let players = {}; // { socket.id: { nickname, score } }

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ✅ Socket.IO 연결
io.on("connection", (socket) => {
  console.log("🟢 연결됨:", socket.id);

  socket.on("getCode", () => {
    socket.emit("code", roomCode);
  });

  socket.on("verifyCode", (code) => {
    socket.emit("codeVerified", code === roomCode);
  });

socket.on("join", ({ nickname, code }) => {
  if (code !== roomCode) return;
  console.log(`👤 참가자 입장: ${nickname}`);
  players[socket.id] = { nickname, score: 0 };

  // ✅ 관리자 포함 전체에 참가자 목록 브로드캐스트
  broadcastPlayerList();
});

socket.on("getPlayerList", () => {
  console.log("🟠 관리자 getPlayerList 요청 수신");
  broadcastPlayerList();
});


  socket.on("start", () => {
    console.log("🚀 게임 시작!");
    io.emit("startGame");
  });

  socket.on("correctMatch", () => {
    if (!players[socket.id]) return;
    players[socket.id].score += 10;
    broadcastScores();
  });

  socket.on("endGame", () => {
    const result = Object.values(players).map(p => ({ nickname: p.nickname, score: p.score }));
    io.emit("finalResult", result);
  });
  
socket.on("disconnect", () => {
  if (players[socket.id]) {
    const nickname = players[socket.id].nickname;
    console.log(`❌ 연결 종료 감지: ${nickname}, 10초 대기 중...`);

    // 👉 10초 동안 기다렸다가 여전히 접속이 없으면 제거
    setTimeout(() => {
      if (!io.sockets.sockets.get(socket.id)) {
        delete players[socket.id];
        console.log(`🧹 ${nickname} 제거됨`);
        broadcastPlayerList();
      } else {
        console.log(`🔄 ${nickname} 재접속 감지 → 제거 안 함`);
      }
    }, 10000);
  } else {
    console.log(`🔌 일반 연결 종료: ${socket.id}`);
  }
});


// ✅ 점수 브로드캐스트
function broadcastScores() {
  const result = Object.values(players).map(p => ({ nickname: p.nickname, score: p.score }));
  io.emit("playerUpdate", result);
}
app.use("/data", express.static("data"));
server.listen(10000, () => {
  console.log("🚀 카드맞추기 서버 실행 중: http://localhost:10000");
});
