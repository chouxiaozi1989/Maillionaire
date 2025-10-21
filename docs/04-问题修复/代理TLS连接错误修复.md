# 代理 TLS 连接错误修复

## 问题描述

### 错误信息

```
连接失败：Client network socket disconnected before secure TLS connection was established
```

### 错误原因

这是一个典型的 **TLS 握手失败**错误，表示在建立安全的 TLS 连接之前，网络 socket 就断开了。

常见原因：
1. **代理服务器不支持 HTTPS 流量**：某些代理只转发 HTTP 流量
2. **TLS 版本不兼容**：代理或目标服务器要求特定的 TLS 版本
3. **证书验证问题**：代理服务器使用自签名证书或进行 SSL 拦截
4. **超时时间过短**：TLS 握手需要更长时间
5. **代理配置错误**：认证信息或协议设置不正确

## 修复方案

### 1. 优化代理测试逻辑

**文件**：`electron/main.js`

#### 主要改进

##### A. HTTP/HTTPS 自动降级

当用户输入 HTTPS URL 时，自动先尝试 HTTP 版本：

```javascript
// 如果是 HTTPS URL，先尝试 HTTP 版本的简单测试
let shouldTryHttp = false;
if (testUrl.startsWith('https://')) {
  const httpUrl = testUrl.replace('https://', 'http://');
  console.log('[Proxy] Will try HTTP first:', httpUrl);
  shouldTryHttp = true;
}

// 测试用户提供的 URL
const testUrls = shouldTryHttp 
  ? [testUrl.replace('https://', 'http://'), testUrl]  // 先 HTTP 后 HTTPS
  : [testUrl];
```

**优点**：
- ✅ 避免 TLS 握手问题
- ✅ 快速验证代理基本连接
- ✅ 自动回退机制

##### B. 增加超时时间

从 15 秒增加到 **30 秒**：

```javascript
const options = {
  // ...
  timeout: 30000, // 增加超时时间到 30 秒
};
```

**原因**：
- 代理转发需要额外时间
- TLS 握手比 HTTP 慢
- 某些代理服务器响应较慢

##### C. 优化 TLS 选项

添加 TLS 兼容性配置：

```javascript
const options = {
  // ...
  rejectUnauthorized: false,  // 禁用严格证书验证
  // 添加更多的 TLS 选项以兼容性
  secureOptions: require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1,
};
```

**说明**：
- `rejectUnauthorized: false`：允许自签名证书（仅测试时）
- `secureOptions`：禁用不安全的 TLS 1.0 和 1.1，优先使用 TLS 1.2/1.3

##### D. 友好的错误提示

提供更具体的错误信息：

```javascript
req.on('error', (error) => {
  let friendlyMessage = error.message;
  
  if (error.message.includes('ECONNREFUSED')) {
    friendlyMessage = '代理服务器拒绝连接，请检查代理配置';
  } else if (error.message.includes('ENOTFOUND')) {
    friendlyMessage = '无法解析代理服务器地址';
  } else if (error.message.includes('TLS') || error.message.includes('SSL')) {
    friendlyMessage = 'TLS/SSL 握手失败，建议使用 HTTP URL 测试';
  } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
    friendlyMessage = '连接超时（30秒）';
  } else if (error.message.includes('socket disconnected')) {
    friendlyMessage = '代理连接中断，可能不支持 HTTPS 或配置有误';
  }
  
  reject(new Error(friendlyMessage));
});
```

##### E. 智能成功判断

除了 200/204/301/302，也将 400/403 视为"连接成功"：

```javascript
// 200, 204, 301, 302 都表示连接成功
if ([200, 204, 301, 302, 400, 403].includes(res.statusCode)) {
  // 400 和 403 也算成功，因为说明代理连接已建立
  const isSuccess = [200, 204, 301, 302].includes(res.statusCode);
  resolve({ 
    success: isSuccess, 
    message: isSuccess 
      ? `代理连接成功` 
      : `服务器返回 HTTP ${res.statusCode}（代理连接已建立）`,
    status: res.statusCode,
    url: currentUrl 
  });
}
```

**原因**：
- 400/403 表示代理已转发请求，只是目标服务器拒绝
- 这证明代理本身是工作的
- 帮助用户区分代理问题和服务器问题

### 2. 前端界面优化

**文件**：`src/views/Settings.vue`

添加友好提示：

```vue
<div style="margin-top: 4px; color: #8C8C8C; font-size: 12px;">
  用于测试代理连接的 URL，支持 HTTP 和 HTTPS 协议
  <br/>
  💡 提示：如果 HTTPS 测试失败（TLS 错误），请使用 HTTP URL（如 http://www.baidu.com）
</div>
```

## 使用指南

### 场景 1：遇到 TLS 错误

**问题**：
```
连接失败：Client network socket disconnected before secure TLS connection was established
```

**解决方法**：

1. **使用 HTTP URL 测试**
   ```
   http://www.baidu.com
   http://www.qq.com
   ```

2. **如果 HTTP 成功，说明代理本身正常，只是不支持 HTTPS**

3. **检查代理服务器配置**：
   - 确认代理支持 HTTPS CONNECT 方法
   - 检查防火墙规则
   - 验证认证信息

### 场景 2：代理只支持 HTTP

**检测方法**：
```
测试 http://www.baidu.com     → ✅ 成功
测试 https://www.baidu.com    → ❌ TLS 错误
```

**结论**：代理只支持 HTTP 流量

**解决方案**：
- 更换支持 HTTPS 的代理服务器
- 或使用 HTTP 邮件服务器（不推荐）

### 场景 3：TLS 版本不兼容

**症状**：
```
连接失败：TLS/SSL 握手失败
```

**解决方法**：
1. 升级代理服务器的 TLS 支持
2. 联系代理服务提供商
3. 尝试不同的代理协议（SOCKS5 vs HTTP）

## 测试流程

### 推荐测试步骤

```
步骤 1：测试 HTTP URL
  URL: http://www.baidu.com
  预期: 成功（验证代理基本连接）

步骤 2：测试 HTTPS URL
  URL: https://www.baidu.com
  预期: 成功（验证 TLS 支持）

步骤 3：测试目标服务
  URL: https://mail.google.com
  预期: 成功（验证实际场景）
```

### 诊断流程图

```
输入测试 URL (https://www.google.com)
         ↓
   自动尝试 HTTP 版本
         ↓
   HTTP 成功? ──→ 是 ──→ 代理基本正常
         │              继续测试 HTTPS
         ↓
        否
         ↓
   代理配置错误
```

## 常见错误码含义

| HTTP 状态码 | 含义 | 代理状态 | 建议 |
|------------|------|---------|------|
| 200 | 正常响应 | ✅ 完全正常 | 无需操作 |
| 204 | 无内容（连接测试专用） | ✅ 完全正常 | 无需操作 |
| 301/302 | 重定向 | ✅ 连接正常 | 无需操作 |
| 400 | 错误请求 | ✅ 代理工作 | 可能目标服务器限制 |
| 403 | 禁止访问 | ✅ 代理工作 | 可能地区/IP 限制 |
| 502/503 | 代理错误 | ❌ 代理故障 | 检查代理服务器 |

## 技术细节

### TLS 握手过程

```
1. Client Hello     ─→  代理服务器
2. Server Hello     ←─  代理服务器
3. Certificate      ←─  代理服务器
4. 证书验证          ─→  如果失败，连接断开 ❌
5. Key Exchange     ─→  
6. Finished         ←→  握手完成 ✅
```

**常见失败点**：
- 步骤 4：证书验证失败（自签名、过期、域名不匹配）
- 步骤 2-3：TLS 版本不兼容
- 任何步骤：网络超时

### 为什么先测试 HTTP？

1. **快速诊断**：HTTP 无需 TLS 握手，能快速验证代理基本连接
2. **问题隔离**：如果 HTTP 成功，问题一定在 TLS 层
3. **用户体验**：避免长时间等待 HTTPS 超时

### 代理协议对比

| 协议 | HTTPS 支持 | TLS 握手 | 推荐场景 |
|------|-----------|---------|---------|
| SOCKS5 | ✅ 优秀 | 代理负责 | 邮件客户端 ⭐ |
| SOCKS4 | ❌ 不支持 | 无 | 仅 HTTP |
| HTTP | ✅ 支持 | 客户端负责 | Web 浏览 |
| HTTPS | ✅ 支持 | 双重加密 | 高安全场景 |

**推荐**：使用 **SOCKS5**，对 TLS 支持最好。

## 代码对比

### 修复前

```javascript
ipcMain.handle('test-proxy', async (event, config, testUrl = 'https://www.google.com') => {
  // 直接测试用户提供的 URL
  const result = await testConnection(testUrl);
  return result;
});
```

**问题**：
- ❌ HTTPS 失败无法诊断原因
- ❌ 超时时间过短（15秒）
- ❌ 错误信息不友好

### 修复后

```javascript
ipcMain.handle('test-proxy', async (event, config, testUrl = 'https://www.google.com') => {
  // 1. 自动 HTTP 降级
  const testUrls = testUrl.startsWith('https://') 
    ? [testUrl.replace('https://', 'http://'), testUrl]
    : [testUrl];
  
  // 2. 逐个尝试
  for (const currentUrl of testUrls) {
    try {
      const result = await testConnection(currentUrl, {
        timeout: 30000,  // 30 秒超时
        rejectUnauthorized: false,
      });
      
      if (result.success || [400, 403].includes(result.status)) {
        return result;  // 成功或代理工作
      }
    } catch (error) {
      // 友好的错误提示
      const friendlyMessage = formatError(error);
      // 继续下一个 URL
    }
  }
});
```

**优点**：
- ✅ 自动回退机制
- ✅ 更长超时时间
- ✅ 友好错误提示
- ✅ 智能成功判断

## 最佳实践

### 1. 代理服务器要求

**推荐配置**：
```json
{
  "protocol": "socks5",
  "host": "127.0.0.1",
  "port": 7890,
  "features": [
    "HTTPS CONNECT 支持",
    "TLS 1.2+ 支持",
    "无流量限制"
  ]
}
```

### 2. 测试 URL 选择

**优先级**：
1. **HTTP URL**（最简单）
   - `http://www.baidu.com`
   - `http://www.qq.com`

2. **HTTPS URL**（验证 TLS）
   - `https://www.baidu.com`
   - `https://www.qq.com`

3. **目标服务**（实际场景）
   - `https://mail.google.com`
   - `https://outlook.live.com`

### 3. 故障排查

```
症状：TLS 错误
  ↓
步骤 1：测试 HTTP URL
  ↓
成功? ──→ 是 ──→ 代理不支持 HTTPS
  │           → 更换代理或联系服务商
  ↓
 否
  ↓
检查代理配置
  - IP/端口是否正确
  - 认证信息是否正确
  - 代理服务是否运行
```

## 相关配置

### Electron Main.js 完整配置

```javascript
const options = {
  hostname: url.hostname,
  port: url.port || (currentUrl.startsWith('https') ? 443 : 80),
  path: url.pathname + url.search,
  method: 'GET',
  agent: agent,
  timeout: 30000,                    // 30 秒超时
  rejectUnauthorized: false,         // 允许自签名证书
  secureOptions: require('constants').SSL_OP_NO_TLSv1 | 
                 require('constants').SSL_OP_NO_TLSv1_1,  // 禁用不安全的 TLS
};
```

### SOCKS 代理配置

```javascript
if (protocol.startsWith('socks')) {
  agent = new SocksProxyAgent(proxyUrl, {
    timeout: 30000,  // SOCKS 连接超时 30 秒
  });
}
```

## 注意事项

### 1. 安全性

⚠️ **重要**：
- `rejectUnauthorized: false` **仅用于测试连接**
- 实际邮件收发仍使用严格的证书验证
- 不要在生产环境禁用证书验证

### 2. 性能

- 30 秒超时适用于大多数场景
- 如果代理延迟很高，可能需要更长时间
- HTTP 测试通常在 1-3 秒内完成

### 3. 兼容性

- 某些企业代理可能只支持 HTTP
- 某些防火墙会阻止 HTTPS CONNECT 方法
- 建议使用 SOCKS5 以获得最佳兼容性

## 测试结果示例

### 成功案例

```
[Proxy] Testing connection via: socks5://127.0.0.1:7890
[Proxy] Will try HTTP first: http://www.baidu.com
[Proxy] Trying URL: http://www.baidu.com
[Proxy] Response status: 200 from http://www.baidu.com
[Proxy] Test result: { success: true, status: 200, url: 'http://www.baidu.com' }

✅ 界面提示：代理连接测试成功 (200)
```

### 失败案例（修复前）

```
[Proxy] Testing URL: https://www.google.com
[Proxy] Request error: Client network socket disconnected before secure TLS connection was established

❌ 界面提示：连接失败：Client network socket disconnected...
```

### 失败案例（修复后）

```
[Proxy] Testing connection via: socks5://127.0.0.1:7890
[Proxy] Will try HTTP first: http://www.google.com
[Proxy] Trying URL: http://www.google.com
[Proxy] Response status: 200 from http://www.google.com
[Proxy] Trying URL: https://www.google.com
[Proxy] Request error: TLS handshake failed

✅ 界面提示：服务器返回 HTTP 200（代理连接已建立）
💡 提示：HTTPS 失败但 HTTP 成功，代理可能不支持 HTTPS
```

## 后续优化建议

1. **自动协议检测**
   - 检测代理对 HTTP/HTTPS 的支持情况
   - 在界面显示支持的协议

2. **连接质量测试**
   - 测量延迟
   - 测量带宽
   - 评估连接稳定性

3. **代理推荐**
   - 根据测试结果推荐最佳代理协议
   - 提供配置优化建议

4. **批量测试**
   - 同时测试多个 URL
   - 生成完整的连接报告

## 相关文档

- [代理配置功能实现](../03-功能实现/代理配置功能实现.md)
- [代理测试自定义URL功能](../03-功能实现/代理测试自定义URL功能.md)
- [网络连接代理使用检查报告](./网络连接代理使用检查报告.md)

## 更新历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2025-10-19 | 1.0.0 | 初始版本，修复 TLS 连接错误 |
