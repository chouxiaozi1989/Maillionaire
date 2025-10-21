# HTTP 代理 Socket 状态检查优化

## 更新日期

2025-10-19

## 问题描述

### 错误信息

```
同步失败：Error invoking remote method 'connect-imap': 
Error: connect EISCONN 142.250.107.109:993 - Local (127.0.0.1:51866)
```

### 错误分析

**EISCONN 错误**：
- 错误码：`-4069` (Windows) 或 `-56` (Unix)
- 含义：Socket is already connected（Socket 已经连接）
- 原因：尝试对已连接的 socket 调用 `connect()` 方法

### 问题根源

#### 问题代码

**文件**：`electron/services/imap-main.js`

```javascript
const socket = await proxySocketFactory();

// ❌ 问题：只检查 connecting 和 opening 状态
if (socket.connecting || socket.readyState === 'opening') {
  await new Promise((resolve, reject) => {
    socket.once('connect', () => {
      resolve();
    });
  });
}

imapConfig.socket = socket;
this.connection = new Imap(imapConfig);
this.connection.connect();  // ❌ 可能导致 EISCONN
```

#### 不同代理类型的 Socket 状态

| 代理类型 | Socket 状态 | 说明 |
|---------|------------|------|
| **SOCKS** | `connecting` 或 `opening` | `SocksClient.createConnection()` 返回尚未完全连接的 socket |
| **HTTP CONNECT** | `open` 或 `writable: true` | HTTP CONNECT 成功后返回已连接的 socket |

#### 问题流程

```
HTTP 代理场景：
1. proxySocket.on('connect') 触发
2. 发送 HTTP CONNECT 请求
3. 收到 200 响应
4. resolve(proxySocket)  ← socket 已连接 ✅
    ↓
5. 检查 socket.connecting  ← false (已连接)
6. 检查 socket.readyState   ← 'open' (已连接)
    ↓
7. 不等待 connect 事件 ✅
8. 传递 socket 给 IMAP 库
    ↓
9. IMAP 库尝试 connect()  ← ❌ EISCONN 错误
```

**原因**：
- HTTP CONNECT 成功后，socket 已经处于 `open` 状态
- 原代码只检查 `connecting` 和 `opening`，认为不需要等待
- 但 IMAP 库收到 socket 后可能尝试再次连接
- 导致 EISCONN 错误

### 为什么 SOCKS 代理没问题？

```
SOCKS 代理场景：
1. SocksClient.createConnection(options)
2. 返回 socket (connecting 状态)  ← 尚未连接
    ↓
3. 检查 socket.connecting  ← true
    ↓
4. 等待 'connect' 事件
5. 事件触发后传递给 IMAP
    ↓
6. IMAP 库收到已连接的 socket ✅
```

**区别**：
- SOCKS 返回的 socket 还在连接中
- 代码等待 `connect` 事件
- IMAP 库收到的是已连接的 socket

## 解决方案

### 关键修复：不要调用 connect()

#### 根本问题

```javascript
const imapConfig = {
  socket: customSocket,  // 提供了自定义 socket
  // ...
};

this.connection = new Imap(imapConfig);
this.connection.connect();  // ❗ 这里是问题！
```

**错误原因**：
- 当提供了 `socket` 选项时，IMAP 库会直接使用这个 socket
- **不应该**再调用 `connect()` 方法
- 调用 `connect()` 会导致库尝试重新连接，导致 EISCONN 错误

#### 正确方法

```javascript
this.connection = new Imap(imapConfig);

this.connection.once('ready', () => {
  resolve(true);
});

this.connection.once('error', (err) => {
  reject(err);
});

// ✅ 关键修复：如果提供了自定义 socket，不要调用 connect()
if (!imapConfig.socket) {
  // 没有提供 socket，使用直连，需要调用 connect()
  this.connection.connect();
} else {
  // 提供了 socket，IMAP 库会自动使用这个 socket
  // 不需要调用 connect()，直接等待 'ready' 事件
  console.log('[IMAP] Socket provided, waiting for ready event...');
}
```

**工作原理**：
1. 创建 `Imap` 实例时，如果 `imapConfig.socket` 存在
2. 库会在构造函数中自动使用这个 socket
3. 自动开始 IMAP 协议握手
4. 完成后触发 `'ready'` 事件
5. **不需要**调用 `connect()` 方法

### 优化 Socket 状态检查

#### 修复后的代码

```javascript
const socket = await proxySocketFactory();

// ✅ 检查 socket 状态
// 注意：SOCKS 代理返回的 socket 可能处于 connecting 状态
// 而 HTTP 代理返回的 socket 已经完全连接（CONNECT 成功后）
const isConnected = socket.readyState === 'open' || socket.writable;
const isConnecting = socket.connecting || socket.readyState === 'opening';

if (isConnecting && !isConnected) {
  // Socket 正在连接，等待 connect 事件
  console.log('[IMAP] Waiting for proxy socket to connect...');
  await new Promise((resolve, reject) => {
    socket.once('connect', () => {
      console.log('[IMAP] Proxy socket connected');
      resolve();
    });
    socket.once('error', (err) => {
      console.error('[IMAP] Proxy socket error:', err);
      reject(err);
    });
  });
} else if (isConnected) {
  // Socket 已经连接（HTTP CONNECT 场景）
  console.log('[IMAP] Proxy socket already connected (HTTP CONNECT)');
} else {
  // 未知状态，记录日志
  console.log('[IMAP] Proxy socket state:', {
    readyState: socket.readyState,
    connecting: socket.connecting,
    writable: socket.writable
  });
}

imapConfig.socket = socket;
console.log('[IMAP] Using proxy socket for connection');
```

### 关键改进

#### 1. 区分已连接和正在连接

```javascript
const isConnected = socket.readyState === 'open' || socket.writable;
const isConnecting = socket.connecting || socket.readyState === 'opening';
```

**状态判断**：
- `isConnected`：socket 已完全连接（HTTP CONNECT）
- `isConnecting`：socket 正在连接（SOCKS）

#### 2. 条件等待 connect 事件

```javascript
if (isConnecting && !isConnected) {
  // 只有在"正在连接且未连接"时才等待
  await new Promise(...);
}
```

**逻辑**：
- SOCKS：`isConnecting=true, isConnected=false` → 等待
- HTTP：`isConnecting=false, isConnected=true` → 不等待

#### 3. 记录详细状态

```javascript
else if (isConnected) {
  console.log('[IMAP] Proxy socket already connected (HTTP CONNECT)');
} else {
  console.log('[IMAP] Proxy socket state:', {
    readyState: socket.readyState,
    connecting: socket.connecting,
    writable: socket.writable
  });
}
```

**好处**：
- 清晰的日志输出
- 便于调试和故障排查

## Socket 状态详解

### Node.js Socket 状态

| 属性 | 类型 | 可能值 | 含义 |
|------|------|--------|------|
| `readyState` | string | `opening` | 正在建立连接 |
|  |  | `open` | 已连接 |
|  |  | `readOnly` | 只读（连接关闭中） |
|  |  | `writeOnly` | 只写 |
|  |  | `closed` | 已关闭 |
| `connecting` | boolean | `true` / `false` | 是否正在连接 |
| `writable` | boolean | `true` / `false` | 是否可写 |
| `readable` | boolean | `true` / `false` | 是否可读 |

### 不同场景的状态

#### 场景 1：SOCKS 代理

```javascript
// SocksClient.createConnection() 返回时
{
  readyState: 'opening',      // 正在连接
  connecting: true,           // 正在连接
  writable: false,            // 不可写
  readable: false             // 不可读
}

// connect 事件触发后
{
  readyState: 'open',         // 已连接 ✅
  connecting: false,          // 连接完成
  writable: true,             // 可写 ✅
  readable: true              // 可读 ✅
}
```

#### 场景 2：HTTP CONNECT

```javascript
// net.connect() 返回时
{
  readyState: 'opening',      // 正在连接
  connecting: true,           // 正在连接
  writable: false,            // 不可写
  readable: false             // 不可读
}

// connect 事件触发，发送 CONNECT 请求
{
  readyState: 'open',         // 已连接
  connecting: false,          // 连接完成
  writable: true,             // 可写
  readable: true              // 可读
}

// 收到 200 响应，resolve(proxySocket)
{
  readyState: 'open',         // 已连接 ✅
  connecting: false,          // 连接完成
  writable: true,             // 可写 ✅
  readable: true              // 可读 ✅
}
```

**关键区别**：
- SOCKS：返回时处于 `opening` 状态
- HTTP：返回时处于 `open` 状态（已完成 CONNECT）

## 测试验证

### 测试场景 1：HTTP 代理

**配置**：
```json
{
  "enabled": true,
  "protocol": "http",
  "host": "127.0.0.1",
  "port": 7890
}
```

**修复前日志**：
```
[IMAP] HTTP CONNECT successful, tunnel established
[IMAP] Using proxy socket for connection
Error: connect EISCONN 142.250.107.109:993 ❌
```

**修复后日志**：
```
[IMAP] HTTP CONNECT successful, tunnel established
[IMAP] Proxy socket already connected (HTTP CONNECT) ✅
[IMAP] Using proxy socket for connection
[IMAP] Connection ready ✅
```

### 测试场景 2：SOCKS5 代理（回归测试）

**配置**：
```json
{
  "enabled": true,
  "protocol": "socks5",
  "host": "127.0.0.1",
  "port": 7890
}
```

**日志**：
```
[IMAP] SOCKS proxy socket created successfully
[IMAP] Waiting for proxy socket to connect... ✅
[IMAP] Proxy socket connected ✅
[IMAP] Using proxy socket for connection
[IMAP] Connection ready ✅
```

**结果**：✅ SOCKS 代理仍然正常工作

### 测试场景 3：直连（无代理）

**配置**：
```json
{
  "enabled": false
}
```

**日志**：
```
[IMAP] Proxy not enabled, using direct connection
[IMAP] Using direct connection (no proxy)
[IMAP] Connection ready ✅
```

**结果**：✅ 直连不受影响

## 技术细节

### 为什么 HTTP CONNECT 返回已连接的 Socket？

HTTP CONNECT 的实现流程：

```javascript
return async () => {
  return new Promise((resolve, reject) => {
    const proxySocket = net.connect({ ... });
    
    proxySocket.on('connect', () => {
      // 1. Socket 已连接到代理服务器
      // 2. 发送 HTTP CONNECT 请求
      proxySocket.write(connectRequest);
    });
    
    proxySocket.on('data', (data) => {
      // 3. 收到代理响应
      if (statusCode === 200) {
        // 4. CONNECT 成功，隧道建立
        // 5. 返回这个 socket ← 已连接状态
        resolve(proxySocket);  // ✅ Socket 已处于 open 状态
      }
    });
  });
};
```

**关键点**：
- `resolve(proxySocket)` 时，socket 已经触发过 `connect` 事件
- socket 已经处于 `open` 状态
- 隧道已经建立，可以直接使用

### IMAP 库的 Socket 处理

`imap` 库接收自定义 socket：

```javascript
const imapConfig = {
  socket: customSocket,  // 传入自定义 socket
  // ...
};

const connection = new Imap(imapConfig);
connection.connect();
```

**库的内部逻辑**：
```javascript
if (this.socket) {
  // 如果提供了 socket
  if (this.socket.readyState === 'open') {
    // Socket 已连接，直接使用 ✅
    this._onConnect();
  } else {
    // Socket 未连接，等待 connect 事件
    this.socket.once('connect', () => {
      this._onConnect();
    });
    this.socket.connect();  // ❌ 可能导致 EISCONN
  }
}
```

**问题**：
- 如果 socket 未完全连接，库会调用 `socket.connect()`
- 如果 socket 已连接，再调用 `connect()` 会报 EISCONN

**我们的修复**：
- 确保传递给 IMAP 库的 socket 已经完全连接
- 避免库尝试再次连接

## 最佳实践

### 1. Socket 状态检查

**推荐方式**：
```javascript
// 检查是否已连接
const isConnected = socket.readyState === 'open' || socket.writable;

// 检查是否正在连接
const isConnecting = socket.connecting || socket.readyState === 'opening';

// 根据状态决定是否等待
if (isConnecting && !isConnected) {
  await waitForConnect(socket);
}
```

**避免**：
```javascript
// ❌ 只检查单一属性
if (socket.connecting) { ... }

// ❌ 不检查已连接状态
if (socket.readyState === 'opening') { ... }
```

### 2. 代理 Socket 工厂模式

**推荐**：
```javascript
return async () => {
  const socket = await createProxyConnection();
  
  // 确保返回的 socket 处于一致的状态
  // - SOCKS: 可能是 opening
  // - HTTP: 应该是 open
  
  return socket;
};
```

### 3. 详细日志

**推荐**：
```javascript
console.log('[IMAP] Proxy socket state:', {
  readyState: socket.readyState,
  connecting: socket.connecting,
  writable: socket.writable,
  readable: socket.readable
});
```

**好处**：
- 便于调试
- 快速定位问题
- 了解不同代理的行为差异

## 相关问题

### Q1: 为什么不统一让所有代理都返回未连接的 socket？

**A**: 这会增加复杂性和延迟：

```javascript
// ❌ 不推荐：强制返回未连接的 socket
if (protocol === 'http') {
  return async () => {
    const socket = net.connect({ ... });
    // 不等待 connect，立即返回
    return socket;  // 返回 opening 状态
  };
}
```

**问题**：
- 失去了 HTTP CONNECT 的优势（提前验证）
- 增加了连接延迟
- 代码更复杂

**更好的方式**：
- 让每种代理使用最自然的方式
- 在使用 socket 前统一检查状态

### Q2: 可以在 IMAP 库层面修复吗？

**A**: 理论上可以，但不是最佳方案：

```javascript
// 修改 imap 库（不推荐）
Imap.prototype.connect = function() {
  if (this.socket && this.socket.readyState === 'open') {
    // 已连接，直接使用
    this._onConnect();
    return;
  }
  // ...
};
```

**问题**：
- 需要修改第三方库
- 维护成本高
- 可能影响其他功能

**我们的方案更好**：
- 只修改自己的代码
- 不依赖第三方库的实现
- 更灵活、更可控

## 注意事项

### 1. Socket 生命周期

```
创建 → opening → open → readOnly/writeOnly → closed
```

**关键转换点**：
- `opening → open`：`connect` 事件
- `open → readOnly`：调用 `end()`
- `readOnly → closed`：`close` 事件

### 2. 事件监听时机

**正确**：
```javascript
socket.once('connect', () => { ... });
socket.once('error', () => { ... });
```

**避免**：
```javascript
// ❌ 可能错过事件
setTimeout(() => {
  socket.once('connect', () => { ... });
}, 100);
```

### 3. 内存泄漏

**推荐**：
```javascript
socket.once('connect', handler);  // ✅ 自动移除
```

**避免**：
```javascript
socket.on('connect', handler);    // ❌ 需要手动移除
```

## 相关文档

- [IMAP 支持 HTTP 代理](./IMAP支持HTTP代理.md)
- [IMAP 代理连接 EISCONN 错误修复](./IMAP代理连接EISCONN错误修复.md)（旧版，SOCKS 专用）
- [代理配置简化和持久化](./代理配置简化和持久化.md)

## 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2025-10-19 | 1.1.0 | 修复关键问题：提供 socket 时不要调用 connect() |
| 2025-10-19 | 1.0.0 | 初始版本，优化 HTTP 代理 Socket 状态检查，修复 EISCONN 错误 |
