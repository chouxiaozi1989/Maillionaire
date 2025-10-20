# Electron 启动问题修复记录

## 问题描述

运行 `npm run electron:dev` 命令时，Vite 开发服务器可以正常启动，但 Electron 窗口无法打开。

## 问题分析

### 根本原因

在 Windows PowerShell 环境下，有两个主要问题：

1. **PowerShell 不支持 `&&` 操作符**
   - 原始脚本：`"wait-on http://localhost:5173 && electron ."`
   - 在 PowerShell 中，`&&` 不是有效的命令分隔符
   - 导致 `wait-on` 命令无法正确执行后续的 electron 命令

2. **Electron 安装不完整**
   - `node_modules/electron` 目录为空
   - Electron 二进制文件未正确下载和安装
   - 导致即使命令执行也会报错

### 症状

```bash
Error: Electron failed to install correctly, 
please delete node_modules/electron and try installing again
```

## 解决方案

### 1. 创建跨平台启动脚本

创建 `scripts/start-electron.js` 文件，使用 Node.js 原生模块来检测服务器状态：

```javascript
const { spawn } = require('child_process');
const net = require('net');

const VITE_PORT = 5173;
const CHECK_INTERVAL = 1000;
const MAX_ATTEMPTS = 60;

function checkServer() {
  const socket = new net.Socket();
  
  socket.setTimeout(500);
  
  socket.on('connect', () => {
    socket.destroy();
    console.log('✓ Vite 服务器已就绪');
    console.log('启动 Electron...\n');
    startElectron();
  });
  
  socket.on('error', (err) => {
    socket.destroy();
    if (attempts >= MAX_ATTEMPTS) {
      console.error('✗ 等待超时');
      process.exit(1);
    }
    retryCheck();
  });
  
  socket.connect(VITE_PORT, 'localhost');
}
```

**优势**：
- ✅ 跨平台兼容（Windows/macOS/Linux）
- ✅ 使用 TCP 连接检测，支持 IPv4 和 IPv6
- ✅ 不依赖外部 shell 命令分隔符

### 2. 修改 package.json 脚本

```json
{
  "scripts": {
    "dev": "vite",
    "electron:start": "electron .",
    "electron:dev": "concurrently -k \"npm run dev\" \"node scripts/start-electron.js\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux"
  }
}
```

**改进**：
- ❌ 删除了 `electron:wait` 脚本（依赖 shell `&&`）
- ✅ 使用 Node.js 脚本替代 shell 命令链

### 3. 重新安装 Electron

```bash
# 卸载 Electron
npm uninstall electron

# 重新安装
npm install electron@26.6.10 --save-dev
```

## 验证结果

### 测试命令

```bash
npm run electron:dev
```

### 预期输出

```
> concurrently -k "npm run dev" "node scripts/start-electron.js"

[1] 等待 Vite 开发服务器启动...
[0] 
[0]   VITE v4.5.14  ready in 427 ms
[0]   ➜  Local:   http://localhost:5173/
[1] ✓ Vite 服务器已就绪
[1] 启动 Electron...
```

### 进程验证

```bash
tasklist | findstr electron
```

应该看到多个 electron.exe 进程：
```
electron.exe    14372    ...    132,624 K
electron.exe     9968    ...    158,396 K
electron.exe     2856    ...     48,856 K
electron.exe      700    ...    122,596 K
electron.exe    18640    ...          K
```

这是正常的，Electron 使用多进程架构（主进程、渲染进程、GPU 进程等）。

## 技术细节

### PowerShell vs Bash

| 特性 | PowerShell | Bash |
|------|-----------|------|
| 命令分隔符 | `;` | `&&` / `;` |
| 条件执行 | `-and` | `&&` |
| 或执行 | `-or` | `\|\|` |

### Electron 多进程架构

Electron 应用包含多个进程：
- **主进程**：管理窗口和应用生命周期
- **渲染进程**：每个窗口一个，运行网页
- **GPU 进程**：处理图形渲染
- **工具进程**：DevTools等

### Vite IPv6 绑定

Vite 默认绑定到 `[::1]:5173`（IPv6），而不是 `127.0.0.1:5173`（IPv4）。

解决方案：
- 使用 `net.Socket` 连接到 `localhost`，让系统自动解析
- Node.js 会优先尝试 IPv6，失败后回退到 IPv4

## 最佳实践

### 1. 跨平台脚本

- ✅ 使用 Node.js 脚本而不是 shell 脚本
- ✅ 使用 `concurrently` 管理多进程
- ✅ 避免使用特定 shell 的语法

### 2. 错误处理

```javascript
socket.on('error', (err) => {
  // 处理连接失败
  if (attempts >= MAX_ATTEMPTS) {
    console.error('超时');
    process.exit(1);
  }
  retryCheck();
});
```

### 3. 超时设置

```javascript
const CHECK_INTERVAL = 1000;  // 检查间隔
const MAX_ATTEMPTS = 60;       // 最大尝试次数
socket.setTimeout(500);        // Socket 超时
```

## 常见问题

### Q1: Electron 窗口一闪而过

**原因**：主进程代码错误或配置问题

**解决**：
- 检查 `electron/main.js` 中的窗口配置
- 查看控制台错误信息
- 确保 Vite 服务器正在运行

### Q2: 端口 5173 被占用

**错误**：`Error: Port 5173 is already in use`

**解决**：
```bash
# Windows
netstat -ano | findstr :5173
taskkill /F /PID <进程ID>

# macOS/Linux
lsof -ti:5173 | xargs kill
```

### Q3: Electron 安装失败

**解决**：
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules
rm -rf node_modules
rm package-lock.json

# 重新安装
npm install
```

### Q4: DevTools 不显示

**解决**：在 `electron/main.js` 中确保：
```javascript
if (isDev) {
  mainWindow.webContents.openDevTools();
}
```

## 相关文件

- `package.json` - NPM 脚本配置
- `scripts/start-electron.js` - Electron 启动脚本
- `electron/main.js` - Electron 主进程
- `vite.config.js` - Vite 配置

## 参考资料

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Vite 官方文档](https://vitejs.dev/)
- [Concurrently](https://github.com/open-cli-tools/concurrently)
- [PowerShell vs Bash](https://docs.microsoft.com/powershell/)

---

**修复日期**：2025-10-19  
**修复版本**：v1.0.1  
**测试平台**：Windows 22H2
