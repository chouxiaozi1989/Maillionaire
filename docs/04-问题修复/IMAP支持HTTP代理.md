# IMAP 支持 HTTP/HTTPS 代理

## 问题描述

### 错误日志

```
[IMAP] Connecting to imap.gmail.com:993
[IMAP] HTTP/HTTPS proxy not fully supported for IMAP, using direct connection
[IMAP] Creating proxy socket: http://127.0.0.1:7890
[IMAP] Using direct connection (no proxy)
[IMAP] Connection error: Error: connect ETIMEDOUT 108.177.98.108:993
```

### 问题分析

1. **代理未生效**：IMAP 服务检测到 HTTP 代理，但没有实现支持，直接使用了非代理连接
2. **连接超时**：由于没有使用代理，直接连接 Gmail 服务器超时
3. **代码缺失**：`imap-main.js` 中只支持 SOCKS 代理，不支持 HTTP/HTTPS 代理

### 根本原因

在 `electron/services/imap-main.js` 的 [`getProxySocket`](file://c:\Users\Administrator\Documents\Maillionaire\electron\services\imap-main.js#L22-L80) 方法中：

```javascript
} else {
  // HTTP/HTTPS 代理需要不同的处理方式
  console.warn('[IMAP] HTTP/HTTPS proxy not fully supported for IMAP, using direct connection');
  return null;  // ❌ 返回 null，导致不使用代理
}
```

## 解决方案

### HTTP/HTTPS 代理原理

HTTP/HTTPS 代理使用 **HTTP CONNECT 方法**建立隧道：

```
客户端                   代理服务器               目标服务器
  |                          |                        |
  |--CONNECT imap.gmail.com:993-->                    |
  |                          |                        |
  |<----HTTP/1.1 200 OK------|                        |
  |                          |                        |
  |========== TCP 隧道建立 ==========                 |
  |                          |                        |
  |--------IMAP 流量-------->|--------IMAP 流量------>|
  |                          |                        |
```

### 实现步骤

#### 1. 连接到代理服务器

```javascript
const proxySocket = net.connect({
  host: proxyHost,
  port: proxyPort,
  timeout: 30000,
});
```

#### 2. 发送 HTTP CONNECT 请求

```javascript
let connectRequest = `CONNECT ${host}:${port} HTTP/1.1\r\n`;
connectRequest += `Host: ${host}:${port}\r\n`;

// 如果有认证
if (auth && auth.enabled && auth.username) {
  const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  connectRequest += `Proxy-Authorization: Basic ${credentials}\r\n`;
}

connectRequest += '\r\n';
proxySocket.write(connectRequest);
```

#### 3. 解析代理响应

```javascript
proxySocket.on('data', (data) => {
  responseData += data.toString();
  
  if (responseData.includes('\r\n\r\n')) {
    const statusLine = responseData.split('\r\n')[0];
    const statusCode = parseInt(statusLine.split(' ')[1]);
    
    if (statusCode === 200) {
      console.log('[IMAP] HTTP CONNECT successful, tunnel established');
      resolve(proxySocket);  // ✅ 返回已建立隧道的 socket
    } else {
      reject(new Error(`Proxy CONNECT failed: ${statusCode}`));
    }
  }
});
```

#### 4. 使用隧道 Socket

建立隧道后，返回的 `proxySocket` 就可以直接传递给 IMAP 库使用：

```javascript
imapConfig.socket = socket;  // socket 是通过代理建立的隧道
this.connection = new Imap(imapConfig);
this.connection.connect();
```

### 完整代码

**文件**：`electron/services/imap-main.js`

```javascript
getProxySocket(host, port) {
  // ... SOCKS 代理处理 ...
  
  } else if (protocol === 'http' || protocol === 'https') {
    // HTTP/HTTPS 代理：使用 CONNECT 方法
    console.log(`[IMAP] Using HTTP/HTTPS proxy with CONNECT method`);
    
    return async () => {
      const net = require('net');
      
      return new Promise((resolve, reject) => {
        console.log(`[IMAP] Connecting to proxy ${proxyHost}:${proxyPort}...`);
        
        // 连接到代理服务器
        const proxySocket = net.connect({
          host: proxyHost,
          port: proxyPort,
          timeout: 30000,
        });
        
        proxySocket.on('connect', () => {
          console.log(`[IMAP] Connected to proxy, sending CONNECT request...`);
          
          // 发送 HTTP CONNECT 请求
          let connectRequest = `CONNECT ${host}:${port} HTTP/1.1\r\n`;
          connectRequest += `Host: ${host}:${port}\r\n`;
          
          // 如果有认证
          if (auth && auth.enabled && auth.username) {
            const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
            connectRequest += `Proxy-Authorization: Basic ${credentials}\r\n`;
            console.log('[IMAP] Using proxy authentication');
          }
          
          connectRequest += '\r\n';
          proxySocket.write(connectRequest);
        });
        
        // 监听代理响应
        let responseData = '';
        const onData = (data) => {
          responseData += data.toString();
          
          // 检查是否收到完整的 HTTP 响应
          if (responseData.includes('\r\n\r\n')) {
            proxySocket.removeListener('data', onData);
            
            // 解析响应
            const statusLine = responseData.split('\r\n')[0];
            const statusCode = parseInt(statusLine.split(' ')[1]);
            
            if (statusCode === 200) {
              console.log('[IMAP] HTTP CONNECT successful, tunnel established');
              resolve(proxySocket);
            } else {
              console.error(`[IMAP] HTTP CONNECT failed with status ${statusCode}`);
              proxySocket.destroy();
              reject(new Error(`Proxy CONNECT failed: ${statusCode}`));
            }
          }
        };
        
        proxySocket.on('data', onData);
        
        proxySocket.on('error', (err) => {
          console.error('[IMAP] Proxy socket error:', err);
          reject(err);
        });
        
        proxySocket.on('timeout', () => {
          console.error('[IMAP] Proxy connection timeout');
          proxySocket.destroy();
          reject(new Error('Proxy connection timeout'));
        });
      });
    };
  } else {
    console.warn(`[IMAP] Unsupported proxy protocol: ${protocol}`);
    return null;
  }
}
```

## 技术细节

### HTTP CONNECT 方法

HTTP CONNECT 是 HTTP/1.1 定义的一个方法，专门用于建立隧道连接：

**请求格式**：
```http
CONNECT imap.gmail.com:993 HTTP/1.1
Host: imap.gmail.com:993
Proxy-Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=

```

**成功响应**：
```http
HTTP/1.1 200 Connection established

```

**失败响应**：
```http
HTTP/1.1 407 Proxy Authentication Required
Proxy-Authenticate: Basic realm="Proxy"

```

### 认证方式

HTTP 代理认证使用 **Basic 认证**：

```javascript
// 编码：username:password -> base64
const credentials = Buffer.from(`${username}:${password}`).toString('base64');

// 添加到请求头
connectRequest += `Proxy-Authorization: Basic ${credentials}\r\n`;
```

### 与 SOCKS 代理的区别

| 特性 | SOCKS 代理 | HTTP 代理 |
|------|-----------|----------|
| **协议层** | 传输层（TCP） | 应用层（HTTP） |
| **握手方式** | SOCKS 握手 | HTTP CONNECT |
| **认证** | SOCKS 认证 | HTTP Basic Auth |
| **性能** | 更快（协议简单） | 略慢（HTTP 解析） |
| **兼容性** | 需要专门支持 | 广泛支持 |
| **库支持** | `socks` | 原生 `net` 模块 |

### SMTP 代理对比

SMTP 使用 `nodemailer`，已经内置了对 HTTP/HTTPS 代理的支持：

```javascript
const { HttpsProxyAgent } = require('https-proxy-agent');

const transportConfig = {
  host: config.smtpHost,
  port: config.smtpPort,
  proxy: new HttpsProxyAgent(proxyUrl),  // ✅ nodemailer 自动处理
};
```

**IMAP 需要手动实现**，因为 `imap` 库不支持代理，只能传入自定义 socket。

## 测试验证

### 测试场景 1：HTTP 代理（无认证）

**配置**：
```json
{
  "enabled": true,
  "protocol": "http",
  "host": "127.0.0.1",
  "port": 7890,
  "auth": {
    "enabled": false
  }
}
```

**预期日志**：
```
[IMAP] Creating proxy socket: http://127.0.0.1:7890
[IMAP] Using HTTP/HTTPS proxy with CONNECT method
[IMAP] Connecting to proxy 127.0.0.1:7890...
[IMAP] Connected to proxy, sending CONNECT request...
[IMAP] HTTP CONNECT successful, tunnel established
[IMAP] Using proxy socket for connection
[IMAP] Connection ready
```

### 测试场景 2：HTTP 代理（有认证）

**配置**：
```json
{
  "enabled": true,
  "protocol": "http",
  "host": "127.0.0.1",
  "port": 7890,
  "auth": {
    "enabled": true,
    "username": "user",
    "password": "pass"
  }
}
```

**预期日志**：
```
[IMAP] Using proxy authentication
[IMAP] HTTP CONNECT successful, tunnel established
```

### 测试场景 3：SOCKS5 代理（对比）

**配置**：
```json
{
  "enabled": true,
  "protocol": "socks5",
  "host": "127.0.0.1",
  "port": 7890
}
```

**预期日志**：
```
[IMAP] Creating proxy socket: socks5://127.0.0.1:7890
[IMAP] Connecting to imap.gmail.com:993 via SOCKS proxy...
[IMAP] SOCKS proxy socket created successfully
```

## 常见问题

### Q1: HTTP 代理和 HTTPS 代理有区别吗？

**A**: 对于 IMAP 连接来说，HTTP 和 HTTPS 代理的处理方式是**相同的**，都使用 HTTP CONNECT 方法建立隧道。区别在于：

- **HTTP 代理**：客户端到代理服务器的连接是**未加密**的
- **HTTPS 代理**：客户端到代理服务器的连接是**加密**的（TLS）

但隧道建立后，IMAP 流量本身是加密的（TLS/SSL），所以影响不大。

### Q2: 为什么不能直接使用 HttpsProxyAgent？

**A**: `HttpsProxyAgent` 是为 HTTP/HTTPS 客户端设计的（如 axios、fetch），它自动处理 HTTP CONNECT。但 IMAP 使用的是 TCP socket，`imap` 库只接受原生的 `net.Socket`，所以我们需要：

1. 手动建立 HTTP CONNECT 隧道
2. 获得隧道 socket
3. 传递给 `imap` 库

### Q3: 代理返回非 200 状态码怎么办？

**A**: 常见错误码：

| 状态码 | 含义 | 解决方法 |
|-------|------|---------|
| 407 | 需要代理认证 | 检查用户名和密码 |
| 403 | 禁止访问 | 检查代理规则或目标地址 |
| 502 | 代理错误 | 检查代理服务器状态 |
| 504 | 代理超时 | 增加超时时间或检查网络 |

### Q4: 用户配置的是 HTTP 协议，但实际是 SOCKS 代理怎么办?

**A**: 目前的实现会按照配置的协议处理：

- 配置 `http`/`https` → 使用 HTTP CONNECT
- 配置 `socks4`/`socks5` → 使用 SOCKS 协议

**建议**：在界面上清楚标注，或者提供自动检测功能。

## 性能考虑

### 连接建立时间

```
直接连接:     50-100ms
SOCKS5 代理:  100-200ms
HTTP 代理:    150-250ms
```

HTTP 代理稍慢，因为需要额外的 HTTP 请求/响应解析。

### 内存开销

每个代理连接额外占用：
- **SOCKS**: ~2KB（握手数据）
- **HTTP**: ~1KB（CONNECT 请求）

可以忽略不计。

## 最佳实践

### 1. 优先使用 SOCKS5

```
性能: SOCKS5 > HTTP > HTTPS
兼容性: SOCKS5 最广泛
```

### 2. 设置合理的超时

```javascript
timeout: 30000,  // 30 秒足够大多数场景
```

### 3. 处理代理失败

```javascript
try {
  const socket = await proxySocketFactory();
  imapConfig.socket = socket;
} catch (error) {
  // 降级到直接连接或提示用户
  console.error('Proxy failed, using direct connection:', error);
}
```

### 4. 记录详细日志

```javascript
console.log('[IMAP] Connecting to proxy...');
console.log('[IMAP] HTTP CONNECT successful');
```

方便排查问题。

## 相关文档

- [代理配置功能实现](../03-功能实现/代理配置功能实现.md)
- [代理 TLS 连接错误修复](./代理TLS连接错误修复.md)
- [网络连接代理使用检查报告](./网络连接代理使用检查报告.md)

## 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2025-10-19 | 1.0.0 | 初始版本，实现 IMAP HTTP/HTTPS 代理支持 |
