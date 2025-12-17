# Gmail API 文件夹同步集成

**日期**: 2025-10-19  
**问题**: 将 Gmail 获取文件夹的方式改为 API 方式  
**状态**: ✅ 已完成

## 问题描述

之前 Gmail 账户使用 IMAP 协议获取文件夹列表，存在以下问题：
- IMAP 协议对 Gmail 标签系统支持不完善
- 需要完整的 IMAP 连接开销
- 无法获取标签的统计信息（未读数、总数等）

需要改用 Gmail API v1 来获取文件夹（标签）信息。

## 解决方案

### 1. Gmail API 服务层（已完成）

**文件**: `src/services/gmail-api.js`

创建了 `GmailApiService` 类，提供以下功能：
- `getLabels(accessToken)` - 获取 Gmail 标签列表
- `listMessages(accessToken, options)` - 列出邮件
- `getMessage(accessToken, messageId)` - 获取邮件详情
- `sendMessage(accessToken, rawMessage)` - 发送邮件
- `createLabel(accessToken, name)` - 创建标签
- `deleteLabel(accessToken, labelId)` - 删除标签
- `makeRequest(url, options)` - 通用 HTTP 请求方法（支持代理）

### 2. Electron 主进程集成

**文件**: `electron/main.js`

添加 Gmail API 请求 IPC 处理器：

```javascript
/**
 * Gmail API 请求 IPC 处理器
 */
ipcMain.handle('gmail-api-request', async (event, url, options) => {
  try {
    const https = require('https');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    // 如果启用了代理，创建 agent
    let agent = null;
    if (proxyConfig && proxyConfig.enabled) {
      const { protocol, host, port, auth } = proxyConfig;
      let proxyUrl;
      if (auth && auth.enabled && auth.username) {
        proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
      } else {
        proxyUrl = `${protocol}://${host}:${port}`;
      }
      agent = new HttpsProxyAgent(proxyUrl);
    }
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        agent: agent,
      };
      
      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data ? JSON.parse(data) : {});
          } else {
            const error = data ? JSON.parse(data) : {};
            reject(new Error(error.error?.message || `HTTP ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  } catch (error) {
    console.error('[Gmail API] Request error:', error);
    throw error;
  }
});
```

**关键特性**：
- ✅ 支持代理配置（HTTP/HTTPS 代理）
- ✅ 自动应用已保存的代理设置
- ✅ 代理认证支持
- ✅ 完整的错误处理

### 3. Preload 脚本暴露 API

**文件**: `electron/preload.js`

添加 Gmail API 方法暴露：

```javascript
// Gmail API 操作
gmailApiRequest: (url, options) => ipcRenderer.invoke('gmail-api-request', url, options),
```

### 4. Mail Store 集成

**文件**: `src/stores/mail.js`

修改 `syncServerFolders()` 方法，支持 Gmail API：

```javascript
async function syncServerFolders() {
  try {
    isSyncing.value = true;
    const account = accountStore.currentAccount;
    
    if (!account) {
      throw new Error('请先选择账户');
    }

    if (window.electronAPI) {
      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com');
      
      if (isGmail && account.accessToken) {
        console.log('[Mail] Syncing Gmail folders via API...');
        
        // 使用 Gmail API 获取标签
        const { gmailApiService } = await import('@/services/gmail-api');
        const labels = await gmailApiService.getLabels(account.accessToken);
        
        // Gmail 系统标签映射
        const gmailSystemLabels = {
          'INBOX': 'inbox',
          'SENT': 'sent',
          'DRAFT': 'drafts',
          'TRASH': 'trash',
          'SPAM': 'spam',
          'STARRED': 'starred',
        };
        
        // 处理标签
        labels.forEach(label => {
          const mappedId = gmailSystemLabels[label.id];
          
          if (mappedId) {
            // 系统标签，更新已有的系统文件夹
            const folder = folders.value.find(f => f.id === mappedId);
            if (folder) {
              folder.gmailLabelId = label.id;
              folder.gmailLabelName = label.name;
              folder.messageTotal = label.messageTotal;
              folder.messageUnread = label.messageUnread;
            }
          } else if (label.type === 'system') {
            // 其他系统标签
            const exists = folders.value.find(f => f.gmailLabelId === label.id);
            if (!exists) {
              folders.value.push({
                id: `gmail_${label.id}`,
                name: label.name,
                gmailLabelId: label.id,
                gmailLabelName: label.name,
                messageTotal: label.messageTotal,
                messageUnread: label.messageUnread,
                icon: 'FolderOutlined',
                system: true,
              });
            }
          } else {
            // 用户自定义标签
            const exists = folders.value.find(f => f.gmailLabelId === label.id);
            if (!exists) {
              folders.value.push({
                id: `gmail_${label.id}`,
                name: label.name,
                gmailLabelId: label.id,
                gmailLabelName: label.name,
                messageTotal: label.messageTotal,
                messageUnread: label.messageUnread,
                icon: 'FolderOutlined',
                system: false,
              });
            } else {
              // 更新计数
              exists.messageTotal = label.messageTotal;
              exists.messageUnread = label.messageUnread;
            }
          }
        });
        
      } else {
        // 非 Gmail 账户，使用 IMAP
        console.log('[Mail] Syncing folders via IMAP...');
        // ... IMAP 逻辑
      }
    }
    
    // 保存到本地
    lastSyncTime.value = new Date().toISOString();
    await storageService.writeJSON('folders.json', {
      folders: folders.value,
      lastSyncTime: lastSyncTime.value,
    });
    
    return folders.value;
  } catch (error) {
    console.error('Failed to sync folders:', error);
    throw error;
  } finally {
    isSyncing.value = false;
  }
}
```

**判断逻辑**：
1. 检测账户是否为 Gmail（三种方式）：
   - `account.provider === 'gmail'`
   - `account.imapHost?.includes('gmail.com')`
   - `account.email?.endsWith('@gmail.com')`

2. 如果是 Gmail 且有 `accessToken`：
   - 使用 Gmail API 获取标签
   - 映射系统标签到应用文件夹
   - 添加用户自定义标签
   - 显示未读数和总数

3. 如果是普通账户：
   - 使用 IMAP 获取文件夹（原有逻辑）

## Gmail 标签映射

### 系统标签映射表

| Gmail Label ID | 应用文件夹 ID | 文件夹名称 |
|----------------|--------------|------------|
| INBOX          | inbox        | 收件箱     |
| SENT           | sent         | 已发送     |
| DRAFT          | drafts       | 草稿箱     |
| TRASH          | trash        | 回收站     |
| SPAM           | spam         | 垃圾邮件   |
| STARRED        | starred      | 星标邮件   |

### 文件夹数据结构

**系统文件夹**：
```javascript
{
  id: 'inbox',                    // 应用内部 ID
  name: '收件箱',                 // 显示名称
  icon: 'InboxOutlined',          // 图标
  system: true,                   // 系统文件夹标记
  gmailLabelId: 'INBOX',          // Gmail 标签 ID
  gmailLabelName: 'INBOX',        // Gmail 标签名称
  messageTotal: 100,              // 总邮件数
  messageUnread: 5,               // 未读数
}
```

**用户自定义标签**：
```javascript
{
  id: 'gmail_Label_123',          // 应用内部 ID
  name: '工作邮件',               // 显示名称（用户设置）
  icon: 'FolderOutlined',         // 图标
  system: false,                  // 非系统文件夹
  gmailLabelId: 'Label_123',      // Gmail 标签 ID
  gmailLabelName: '工作邮件',     // Gmail 标签名称
  messageTotal: 50,               // 总邮件数
  messageUnread: 3,               // 未读数
}
```

## 优势

1. **更准确的标签系统**
   - Gmail 标签和文件夹的概念一一对应
   - 支持一封邮件多个标签

2. **实时统计信息**
   - 获取每个标签的邮件总数
   - 获取每个标签的未读数
   - 无需扫描邮件即可显示统计

3. **更好的性能**
   - 不需要建立 IMAP 连接
   - API 调用更轻量
   - 减少网络往返

4. **完整的代理支持**
   - Gmail API 请求通过主进程处理
   - 自动应用代理配置
   - 支持代理认证

## OAuth2 Scope 更新

**文件**: `src/services/oauth.js`

Gmail OAuth2 scope 已更新为：
```javascript
scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels'
```

**权限说明**：
- `gmail.modify` - 读取和修改邮件
- `gmail.labels` - 管理标签

## 测试步骤

1. **添加 Gmail 账户**
   - 使用 OAuth2 授权
   - 确保获取到 access_token、refresh_token 和 expiresAt

2. **同步文件夹**
   - 点击“同步文件夹”按钮
   - 检查是否使用 Gmail API（查看控制台日志）
   - 验证标签列表是否正确

3. **查看统计信息**
   - 检查每个文件夹的未读数
   - 检查总邮件数是否显示

4. **自定义标签**
   - 在 Gmail 网页版创建自定义标签
   - 重新同步，检查是否出现在列表中

5. **代理测试**
   - 启用代理
   - 同步文件夹
   - 验证是否通过代理访问 Gmail API

6. **Token 刷新测试** 🆕
   - 手动修改账户的 expiresAt 为过去的时间
   - 尝试同步文件夹
   - 验证是否自动刷新 token
   - 检查控制台日志：`[Mail] Access token expired or expiring soon, refreshing...`
   - 确认刷新后的 token 被保存到账户中

## 注意事项

1. **Token 过期处理** ✅
   - 在调用 Gmail API 前自动检查 token 有效期
   - 如果 token 过期或即将过期（5分钟内），自动使用 refresh_token 刷新
   - 刷新后更新账户的 accessToken 和 expiresAt
   - 如果刷新失败，提示用户重新登录
   
   **实现细节**：
   ```javascript
   // src/stores/mail.js
   async function ensureValidToken(account, accountStore) {
     // 检查令牌是否过期（提前5分钟刷新）
     const expiresAt = account.expiresAt || 0
     const now = Date.now()
     const bufferTime = 5 * 60 * 1000 // 5分钟缓冲时间
     
     if (expiresAt > now + bufferTime) {
       return account.accessToken
     }
     
     // 令牌过期，使用 refreshToken 刷新
     const { oauth2Service } = await import('@/services/oauth')
     const tokenResult = await oauth2Service.refreshToken(
       account.provider || 'gmail',
       account.refreshToken
     )
     
     // 更新账户令牌
     await accountStore.updateAccount(account.id, {
       accessToken: tokenResult.accessToken,
       expiresAt: tokenResult.expiresAt,
     })
     
     return tokenResult.accessToken
   }
   ```

2. **错误处理**
   - API 调用失败时会抛出异常
   - 需要在 UI 层显示友好的错误信息
   - 可以考虑降级到 IMAP 模式

3. **标签 ID 持久化**
   - 文件夹数据保存到 `folders.json`
   - 包含 `gmailLabelId` 和 `gmailLabelName`
   - 用于后续邮件操作时的标签引用

4. **兼容性**
   - 非 Gmail 账户仍然使用 IMAP
   - 保持向后兼容
   - 浏览器模式下使用模拟数据

## 下一步优化

1. **邮件列表获取**
   - 使用 Gmail API 获取邮件列表
   - 替代 IMAP 的 SEARCH 和 FETCH

2. **邮件操作**
   - 使用 Gmail API 标记已读
   - 使用 Gmail API 添加/删除标签
   - 使用 Gmail API 发送邮件

3. **批量操作**
   - Gmail API 支持批量请求
   - 可以一次性获取多个邮件详情

4. **缓存策略**
   - 缓存标签列表
   - 定期更新未读数
   - 减少 API 调用次数

## 相关文件

- `src/services/gmail-api.js` - Gmail API 服务（新建）
- `electron/main.js` - 添加 `gmail-api-request` 处理器
- `electron/preload.js` - 暴露 `gmailApiRequest` 方法
- `src/stores/mail.js` - 修改 `syncServerFolders()` 方法
- `src/services/oauth.js` - 更新 Gmail OAuth2 scope

## 参考资源

- [Gmail API v1 文档](https://developers.google.com/gmail/api/v1/reference)
- [Gmail API Labels](https://developers.google.com/gmail/api/v1/reference/users/labels)
- [Gmail API Messages](https://developers.google.com/gmail/api/v1/reference/users/messages)
- [OAuth2 Scopes](https://developers.google.com/gmail/api/auth/scopes)
