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
let gameStarted = false;

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}
function broadcastPlayerList() {
  const nicknames = Object.values(players).map(p => p.nickname);
  console.log("📢 전체 참가자 목록 브로드캐스트:", nicknames);
  io.emit("playerList", nicknames);
}

// ✅ 점수 브로드캐스트
function broadcastScores() {
  const result = Object.values(players).map(p => ({
    nickname: p.nickname,
    score: p.score
  }));
  io.emit("playerUpdate", result);
}
  let alreadySentStartTo = new Set();

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
   // 👉 닉네임 중복 제거 (같은 닉네임이 이미 있으면 이전 socket 제거)
  const existingSocketId = Object.keys(players).find(id => players[id].nickname === nickname);
  if (existingSocketId) {
    delete players[existingSocketId];
  }
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
     gameStarted = true;
    io.emit("startGame");
  });

  socket.on("correctMatch", () => {
    if (!players[socket.id]) return;
    players[socket.id].score += 10;
    broadcastScores();
  });

  socket.on("resetGame", () => {
  players = {};
  gameStarted = false;
  roomCode = generateCode();

  alreadySentStartTo = new Set();  // ✅ 재시작 시 초기화
  broadcastPlayerList();           // 닉네임 목록 초기화
  io.emit("gameReset");            // 클라이언트에 초기화 알림
  io.emit("code", roomCode);       // 새 코드 전송
  console.log("🔄 수동 초기화 완료, 새 코드:", roomCode);
});
  socket.on("resetServer", () => {
  console.log("🧹 서버 수동 초기화 요청 수신");
  roomCode = generateCode();
  players = {};
  gameStarted = false;
  io.emit("code", roomCode);
  broadcastPlayerList();
});

  socket.on("endGame", () => {
    const result = Object.values(players).map(p => ({ nickname: p.nickname, score: p.score }));
    io.emit("finalResult", result);
  });
 
socket.on("requestStartStatus", () => {
  if (gameStarted && !alreadySentStartTo.has(socket.id)) {
    console.log("🔁 재접속자에게 startGame 전송:", socket.id);
    socket.emit("startGame");
    alreadySentStartTo.add(socket.id);
  }
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
}); 

app.use("/data", express.static("data"));
server.listen(10000, () => {
  console.log("🚀 카드맞추기 서버 실행 중: http://localhost:10000");
});
