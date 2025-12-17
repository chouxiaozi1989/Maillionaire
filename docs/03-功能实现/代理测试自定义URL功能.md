# 代理测试自定义 URL 功能

## 功能概述

为代理设置添加了自定义测试 URL 功能，用户可以手动指定用于测试代理连接的 URL，默认值为 `https://www.google.com`。

## 更新日期

2025-10-19

## 功能特性

### 1. 自定义测试 URL

- ✅ **手动输入**：用户可以在代理设置界面输入任意测试 URL
- ✅ **默认值**：默认使用 `https://www.google.com`
- ✅ **URL 验证**：自动验证输入的 URL 格式是否正确
- ✅ **快速重置**：提供重置按钮，一键恢复默认值
- ✅ **协议支持**：支持 HTTP 和 HTTPS 协议

### 2. 测试功能优化

- ✅ **单 URL 测试**：测试用户指定的 URL
- ✅ **超时控制**：15 秒超时时间，适应不同网络环境
- ✅ **SSL 宽松模式**：禁用严格的 SSL 证书验证（仅测试时）
- ✅ **详细日志**：完整的测试过程日志输出
- ✅ **状态码显示**：在成功消息中显示 HTTP 状态码

## 修改的文件

### 1. src/views/Settings.vue

**修改位置**：代理设置面板

**新增内容**：

```vue
<!-- 测试 URL 输入框 -->
<a-form-item label="测试 URL">
  <a-input 
    v-model:value="testUrl" 
    placeholder="https://www.google.com"
    style="width: 400px"
  >
    <template #addonAfter>
      <a-button 
        type="link" 
        size="small" 
        @click="testUrl = 'https://www.google.com'"
        style="padding: 0 8px"
      >
        重置
      </a-button>
    </template>
  </a-input>
  <div style="margin-top: 4px; color: #8C8C8C; font-size: 12px;">
    用于测试代理连接的 URL，支持 HTTP 和 HTTPS 协议
  </div>
</a-form-item>
```

**新增变量**：

```javascript
const testUrl = ref('https://www.google.com')
```

**修改方法**：`handleTestProxy()`

```javascript
async function handleTestProxy() {
  if (!proxySettings.value.enabled) {
    message.warning('请先启用代理')
    return
  }
  
  // 验证测试 URL
  if (!testUrl.value || !testUrl.value.trim()) {
    message.warning('请输入测试 URL')
    return
  }
  
  // 简单的 URL 格式验证
  try {
    new URL(testUrl.value)
  } catch (error) {
    message.warning('请输入有效的 URL（如 https://www.google.com）')
    return
  }
  
  testingProxy.value = true
  try {
    const result = await proxyConfig.testConnection(testUrl.value)
    if (result.success) {
      message.success(`代理连接测试成功 (${result.status || 200})`)
    } else {
      message.error(`连接失败：${result.message}`)
    }
  } catch (error) {
    message.error(`测试失败：${error.message}`)
  } finally {
    testingProxy.value = false
  }
}
```

### 2. src/config/proxy.js

**修改方法**：`testConnection()`

**修改前**：

```javascript
async testConnection() {
  try {
    if (window.electronAPI && window.electronAPI.testProxy) {
      return await window.electronAPI.testProxy(this.config)
    }
    // ...
  }
}
```

**修改后**：

```javascript
/**
 * 测试代理连接
 * @param {string} testUrl - 测试 URL，默认为 https://www.google.com
 */
async testConnection(testUrl = 'https://www.google.com') {
  try {
    if (window.electronAPI && window.electronAPI.testProxy) {
      return await window.electronAPI.testProxy(this.config, testUrl)
    }
    
    // 浏览器环境简单测试
    const response = await fetch(testUrl, {
      method: 'HEAD',
      mode: 'no-cors',
    })
    return { success: true, message: '连接成功' }
  } catch (error) {
    return { 
      success: false, 
      message: error.message || '连接失败' 
    }
  }
}
```

### 3. electron/main.js

**修改处理器**：`test-proxy`

**主要变化**：

1. **参数变更**：
   ```javascript
   // 修改前
   ipcMain.handle('test-proxy', async (event, config) => { ... })
   
   // 修改后
   ipcMain.handle('test-proxy', async (event, config, testUrl = 'https://www.google.com') => { ... })
   ```

2. **单 URL 测试**：
   - 移除了多 URL 备用逻辑
   - 只测试用户提供的 URL
   - 增加超时时间到 15 秒

3. **返回值优化**：
   ```javascript
   return { 
     success: true, 
     message: `代理连接成功`,
     status: res.statusCode,  // 新增：返回 HTTP 状态码
     url: testUrl 
   }
   ```

## 使用指南

### 1. 基本使用

1. 打开**设置** → **代理设置**
2. 启用代理并配置代理服务器信息
3. 在**测试 URL** 输入框中输入要测试的 URL
   - 默认值：`https://www.google.com`
   - 可以自定义任何 HTTP/HTTPS URL
4. 点击**测试连接**按钮

### 2. 推荐测试 URL

根据不同场景，推荐使用以下测试 URL：

#### 国际网络测试
- `https://www.google.com` - Google 主页（默认）
- `http://www.gstatic.com/generate_204` - Google 连接测试（HTTP）
- `https://www.facebook.com` - Facebook
- `https://www.youtube.com` - YouTube

#### 国内网络测试
- `https://www.baidu.com` - 百度
- `https://www.qq.com` - 腾讯
- `https://www.taobao.com` - 淘宝

#### 邮件服务器测试
- `https://mail.google.com` - Gmail
- `https://outlook.live.com` - Outlook
- `https://mail.qq.com` - QQ 邮箱

#### HTTP 协议测试（避免 SSL 问题）
- `http://www.gstatic.com/generate_204`
- `http://www.baidu.com`

### 3. 测试结果解读

#### 成功提示
```
代理连接测试成功 (200)
```
- 括号中的数字是 HTTP 状态码
- 200：正常响应
- 301/302：重定向（也表示连接成功）
- 204：无内容（专用于连接测试）

#### 失败提示
```
连接失败：连接超时（15秒）
```
可能原因：
- 代理服务器无法访问目标 URL
- 网络延迟过高
- 目标服务器被封锁

```
连接失败：HTTP 403
```
- 目标服务器拒绝访问（可能是防火墙或地区限制）

## 技术细节

### URL 验证逻辑

```javascript
try {
  new URL(testUrl.value)
} catch (error) {
  message.warning('请输入有效的 URL（如 https://www.google.com）')
  return
}
```

使用浏览器原生的 `URL` 构造函数进行验证，确保输入的是合法 URL。

### SSL 证书验证

测试连接时临时禁用严格的 SSL 验证：

```javascript
const options = {
  // ...
  rejectUnauthorized: false,  // 禁用 SSL 证书验证
}
```

**注意**：这只用于测试连接，实际的邮件收发仍然使用严格的 SSL 验证。

### 超时控制

```javascript
timeout: 15000,  // 15 秒超时
```

考虑到代理转发延迟，将超时时间从 10 秒增加到 15 秒。

### 协议自动判断

```javascript
const lib = testUrl.startsWith('https') ? https : http;
const url = new URL(testUrl);

const options = {
  hostname: url.hostname,
  port: url.port || (testUrl.startsWith('https') ? 443 : 80),
  // ...
};
```

根据 URL 协议自动选择 HTTP 或 HTTPS 模块，并设置正确的端口。

## 与旧版本的区别

### 旧版本（多 URL 备用）

```javascript
// 测试多个 URL，任何一个成功就返回
const testUrls = [
  'http://www.gstatic.com/generate_204',
  'https://www.google.com',
  'https://www.baidu.com',
];

for (const testUrl of testUrls) {
  try {
    const result = await testConnection(testUrl);
    if (result.success) return result;
  } catch (error) {
    continue;  // 继续下一个
  }
}
```

**优点**：容错性强，总能找到一个可用的测试 URL  
**缺点**：用户无法控制测试哪个 URL，可能误判代理性能

### 新版本（单 URL 测试）

```javascript
// 测试用户指定的 URL
const result = await testConnection(testUrl);
return result;
```

**优点**：
- ✅ 用户可以精确测试特定服务的可达性
- ✅ 更准确地反映代理对目标服务的支持情况
- ✅ 灵活性更高，可以测试任何 URL

**缺点**：
- ⚠️ 如果目标 URL 本身有问题，可能误判代理故障

## 最佳实践

### 1. 测试流程建议

```
步骤 1：使用默认 URL (https://www.google.com) 测试基本连接
步骤 2：使用 HTTP URL (http://www.gstatic.com/generate_204) 排查 SSL 问题
步骤 3：使用目标服务 URL (如 https://mail.google.com) 测试实际场景
```

### 2. 故障排查

| 症状 | 可能原因 | 解决方法 |
|------|----------|----------|
| 所有 HTTPS URL 失败 | SSL 拦截/证书问题 | 使用 HTTP URL 测试 |
| Google 成功，Gmail 失败 | 防火墙规则 | 检查代理服务器规则 |
| 连接超时 | 代理服务器离线 | 检查代理配置 |
| HTTP 400/403 | 访问限制 | 更换测试 URL |

### 3. 推荐配置

```javascript
// 代理设置示例
{
  enabled: true,
  protocol: 'socks5',
  host: '127.0.0.1',
  port: 7890,
  auth: {
    enabled: false
  }
}

// 测试 URL
testUrl = 'https://www.google.com'  // 默认推荐
```

## 注意事项

1. **测试 URL 的选择**
   - 优先选择目标服务相关的 URL（如测试 Gmail 代理时使用 `https://mail.google.com`）
   - 避免使用本地或内网 URL
   - 确保 URL 协议正确（http:// 或 https://）

2. **测试结果的解读**
   - 测试成功不代表所有服务都可用
   - 建议测试多个 URL 全面验证
   - 关注 HTTP 状态码，200/204 最理想

3. **安全性**
   - 测试时临时禁用了 SSL 验证
   - 实际邮件收发仍使用严格验证
   - 不要使用测试功能传输敏感信息

4. **性能考虑**
   - 15 秒超时对大多数场景足够
   - 如果经常超时，考虑检查网络环境
   - 避免使用响应慢的测试 URL

## 示例场景

### 场景 1：测试 Gmail 访问

```
代理配置：socks5://127.0.0.1:7890
测试 URL：https://mail.google.com
预期结果：代理连接测试成功 (200)
```

### 场景 2：排查 SSL 问题

```
测试 1：https://www.google.com → 失败
测试 2：http://www.gstatic.com/generate_204 → 成功
结论：代理本身正常，但 HTTPS 有问题，可能是证书拦截
```

### 场景 3：测试国内外访问

```
测试 1：https://www.google.com → 成功
测试 2：https://www.baidu.com → 成功
结论：代理同时支持国内外访问
```

## 后续优化建议

1. **预设 URL 列表**
   - 添加常用测试 URL 下拉选择
   - 快速切换不同测试场景

2. **批量测试**
   - 一次测试多个 URL
   - 生成详细的连接报告

3. **测试历史**
   - 保存测试记录
   - 对比不同时间的测试结果

4. **智能推荐**
   - 根据代理类型推荐测试 URL
   - 自动选择最佳测试方案

## 相关文档

- [代理配置功能实现](./代理配置功能实现.md)
- [网络连接代理使用检查报告](../04-问题修复/网络连接代理使用检查报告.md)
- [代理测试最佳实践](../05-用户指南/代理测试指南.md)（待创建）

## 变更历史

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2025-10-19 | 1.0.0 | 初始版本，实现自定义测试 URL 功能 |
