#!/usr/bin/env node

/**
 * Electron 开发模式启动脚本
 * 等待 Vite 服务器启动后再启动 Electron
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

const VITE_PORT = 5173;
const CHECK_INTERVAL = 1000; // 1秒检查一次
const MAX_ATTEMPTS = 60; // 最多等待60秒

let attempts = 0;

console.log('等待 Vite 开发服务器启动...');

function checkServer() {
  attempts++;
  
  // 使用 TCP 连接检查端口是否打开
  const socket = new net.Socket();
  
  socket.setTimeout(500);
  
  socket.on('connect', () => {
    socket.destroy();
    console.log('✓ Vite 服务器已就绪');
    console.log('启动 Electron...\n');
    startElectron();
  });
  
  socket.on('timeout', () => {
    socket.destroy();
    retryCheck();
  });
  
  socket.on('error', (err) => {
    socket.destroy();
    if (attempts >= MAX_ATTEMPTS) {
      console.error(`✗ 等待超时: Vite 服务器未能在 ${MAX_ATTEMPTS} 秒内启动`);
      process.exit(1);
    }
    retryCheck();
  });
  
  socket.connect(VITE_PORT, 'localhost');
}

function retryCheck() {
  if (attempts < MAX_ATTEMPTS) {
    setTimeout(checkServer, CHECK_INTERVAL);
  }
}

function startElectron() {
  const electron = spawn('electron', ['.'], {
    stdio: 'inherit',
    shell: true,
  });

  electron.on('close', (code) => {
    console.log(`Electron 进程退出，代码: ${code}`);
    process.exit(code);
  });

  electron.on('error', (err) => {
    console.error('启动 Electron 失败:', err);
    process.exit(1);
  });
}

// 开始检查
checkServer();
