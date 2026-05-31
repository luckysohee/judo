import { spawn } from "node:child_process";
import os from "node:os";

/** 로컬·폰 테스트 — 브라우저는 :5173 만 열면 됨 (/api → Vite proxy → server:4000) */
const children = [];

function getLanIpv4() {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const net of ifaces || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

const lanIp = getLanIpv4();
const phoneUrl = lanIp ? `http://${lanIp}:5173` : "http://<맥_IP>:5173";
console.log(`
📱 폰: ${phoneUrl}
💻 PC: http://localhost:5173

Google 로그인(폰) — Supabase 대시보드 → Authentication → URL Configuration
  Redirect URLs 에 아래를 추가한 뒤 저장:
    ${phoneUrl}/**
    http://localhost:5173/**
  (Site URL 이 localhost 만이면, 로그인 후 localhost 로 돌아가 폰에서 "연결할 수 없음" 뜸)
`);

function run(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(child);
  return child;
}

run("npm", ["run", "dev", "--prefix", "server"]);
run("npx", ["vite", "--strictPort"]);

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM") return;
    shutdown(typeof code === "number" ? code : 1);
  });
}
