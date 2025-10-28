# Gmail API 操作功能总结

## 📋 功能清单

本次开发完成了 Gmail 邮件的完整操作功能，全部使用 Google API 实现并同步到服务器端。

### ✅ 已实现功能

| 功能 | Gmail API | SMTP/IMAP | 状态 |
|------|-----------|-----------|------|
| 发送邮件 | ✅ `messages.send` | ✅ SMTP | 完成 |
| 回复邮件 | ✅ `messages.send` (保持线程) | ✅ SMTP | 完成 |
| 转发邮件 | ✅ `messages.send` | ❌ | 完成 |
| 删除邮件 | ✅ `messages.trash` | ✅ IMAP | 完成 |
| 永久删除 | ✅ `messages.delete` | ❌ | 完成 |
| 恢复删除 | ✅ `messages.untrash` | ❌ | 完成 |
| 标记已读 | ✅ `messages.modify` | ✅ IMAP | 完成 |
| 标记未读 | ✅ `messages.modify` | ❌ | 完成 |
| 添加星标 | ✅ `messages.modify` | ❌ | 完成 |
| 移除星标 | ✅ `messages.modify` | ❌ | 完成 |
| 修改标签 | ✅ `messages.modify` | ❌ | 完成 |

---

## 🏗️ 架构设计

### 分层结构

```
UI 层 (Vue 组件)
    ↓
Store 层 (mail.js - 智能路由)
    ↓
    ├─→ Gmail API Service (gmail-api.js)
    │       ↓
    │   Gmail API v1 (Google Server)
    │
    └─→ SMTP/IMAP (Electron IPC)
            ↓
        传统邮件服务器
```

### 智能路由

系统会自动检测账户类型并选择最佳方式：

- **Gmail 账户** + OAuth2 认证 → 使用 Gmail API
- **其他账户** → 使用 SMTP/IMAP

**Gmail 账户判断条件**（满足任一即可）：
```javascript
const isGmail = 
  account.provider === 'gmail' || 
  account.imapHost?.includes('gmail.com') ||
  account.email?.endsWith('@gmail.com')
```

---

## 📁 文件修改清单

### 1. 新增文件

| 文件路径 | 行数 | 说明 |
|----------|------|------|
| `docs/03-功能实现/Gmail邮件操作API集成.md` | 1098 | 技术实现文档 |
| `docs/03-功能实现/Gmail操作使用示例.md` | 928 | 使用示例文档 |

### 2. 修改文件

| 文件路径 | 新增行数 | 说明 |
|----------|----------|------|
| `src/services/gmail-api.js` | ~400 | 新增邮件操作方法 |
| `src/stores/mail.js` | ~350 | 新增智能路由方法 |

---

## 🔑 核心方法

### Gmail API Service (`gmail-api.js`)

#### 邮件构建
- `buildRawMessage(mail)` - 构建 RFC 2822 格式邮件

#### 发送操作
- `send(accessToken, mail)` - 发送新邮件
- `reply(accessToken, originalMessageId, replyMail)` - 回复邮件（保持线程）
- `forward(accessToken, originalMessageId, forwardMail)` - 转发邮件

#### 删除操作
- `trashMessage(accessToken, messageId)` - 移到回收站
- `untrashMessage(accessToken, messageId)` - 从回收站恢复
- `deleteMessage(accessToken, messageId)` - 永久删除

#### 标签操作
- `modifyMessage(accessToken, messageId, modifications)` - 修改标签
- `markAsRead(accessToken, messageId)` - 标记已读
- `markAsUnread(accessToken, messageId)` - 标记未读
- `addStar(accessToken, messageId)` - 添加星标
- `removeStar(accessToken, messageId)` - 移除星标

### Mail Store (`mail.js`)

#### 用户操作方法
- `sendMail(mailData)` - 发送邮件（智能路由）
- `replyMail(mailId, replyData)` - 回复邮件（智能路由）
- `deleteMailFromServer(mailId)` - 删除邮件并同步到服务器
- `markAsReadOnServer(mailId, read)` - 标记已读/未读并同步
- `toggleFlagOnServer(mailId)` - 切换星标并同步

---

## 🎯 技术亮点

### 1. RFC 2822 邮件格式

严格遵循互联网邮件格式标准：

```javascript
From: sender@gmail.com
To: receiver@example.com
Subject: Test Email
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

<p>Email body</p>
```

### 2. 邮件线程保持

回复时自动处理邮件会话：

```javascript
{
  threadId: 'original-thread-id',        // 保持同一会话
  inReplyTo: '<message-id@example.com>', // 回复的邮件
  references: '<msg1@> <msg2@>',         // 完整引用链
}
```

### 3. Base64 URL 编码

Gmail API 要求使用特殊编码格式：

```javascript
// 标准 Base64: abc+def/ghi=
// Base64 URL:   abc-def_ghi
const base64Url = base64
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')
```

### 4. OAuth2 令牌自动刷新

提前 5 分钟检测并刷新令牌：

```javascript
const expiresAt = account.expiresAt
const now = Date.now()
const bufferTime = 5 * 60 * 1000  // 5 分钟缓冲

if (expiresAt > now + bufferTime) {
  return account.accessToken  // 令牌有效
} else {
  // 自动刷新
  const tokenResult = await oauth2Service.refreshToken(...)
  await accountStore.updateAccount(account.id, {
    accessToken: tokenResult.accessToken,
    expiresAt: tokenResult.expiresAt,
  })
  return tokenResult.accessToken
}
```

### 5. Gmail 标签系统

使用 Gmail 的标签系统管理邮件状态：

| 操作 | 标签变化 |
|------|----------|
| 标记已读 | 移除 `UNREAD` |
| 标记未读 | 添加 `UNREAD` |
| 添加星标 | 添加 `STARRED` |
| 移除星标 | 移除 `STARRED` |
| 移到回收站 | 添加 `TRASH` |

---

## 📊 使用示例

### 发送邮件

```javascript
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()

await mailStore.sendMail({
  to: ['user1@example.com', 'user2@example.com'],
  cc: ['manager@example.com'],
  subject: '项目进展报告',
  body: '<h1>本周进展</h1><p>详细内容...</p>',
})
```

### 回复邮件

```javascript
await mailStore.replyMail('mail-id-123', {
  body: '<p>感谢您的反馈...</p>',
})
// 自动保持邮件线程，无需手动设置 In-Reply-To
```

### 删除邮件

```javascript
await mailStore.deleteMailFromServer('mail-id-123')
// Gmail: 移到回收站（可恢复）
// IMAP: 添加删除标记
```

### 标记已读

```javascript
await mailStore.markAsReadOnServer('mail-id-123', true)  // 已读
await mailStore.markAsReadOnServer('mail-id-123', false) // 未读
```

### 切换星标

```javascript
await mailStore.toggleFlagOnServer('mail-id-123')
// 自动检测当前状态并切换
```

---

## 🔐 安全特性

### 1. 令牌加密存储
- ✅ refresh_token 使用 Electron `safeStorage` 加密
- ✅ access_token 存储在内存中
- ❌ 不在日志中打印完整令牌

### 2. HTTPS 通信
- ✅ 所有 Gmail API 请求使用 HTTPS
- ✅ 自动验证 SSL 证书

### 3. 权限最小化
只请求必要的 OAuth2 scope：
```javascript
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',     // 发送
  'https://www.googleapis.com/auth/gmail.modify',   // 修改
  'https://www.googleapis.com/auth/gmail.readonly', // 读取
]
```

---

## ⚡ 性能优化

### 1. 批量操作
```javascript
// 批量标记已读
const promises = mailIds.map(id => 
  mailStore.markAsReadOnServer(id, true)
)
await Promise.all(promises)
```

### 2. 分批请求
```javascript
// 每批 10 个，避免一次请求过多
const batchSize = 10
for (let i = 0; i < messageIds.length; i += batchSize) {
  const batch = messageIds.slice(i, i + batchSize)
  await Promise.all(batch.map(id => fetchMessage(id)))
}
```

### 3. 防抖处理
```javascript
import { debounce } from 'lodash-es'

const debouncedMarkAsRead = debounce(async (mailId) => {
  await mailStore.markAsReadOnServer(mailId, true)
}, 500)
```

---

## 🧪 测试建议

### 单元测试
- [x] RFC 2822 邮件格式构建
- [x] Base64 URL 编码/解码
- [x] 令牌自动刷新逻辑
- [x] Gmail 账户判断逻辑

### 集成测试
- [ ] 发送邮件到测试账户
- [ ] 回复邮件并验证线程
- [ ] 删除邮件并验证回收站
- [ ] 标记已读并验证标签变化
- [ ] 星标操作并验证同步

### 手动测试
1. 使用 Gmail 账户登录
2. 发送一封测试邮件
3. 回复该邮件（检查线程）
4. 删除邮件（检查回收站）
5. 标记已读/星标（检查同步）

---

## 📚 相关文档

1. **技术实现文档**
   - 文件: `docs/03-功能实现/Gmail邮件操作API集成.md`
   - 内容: 完整的技术实现细节、API 文档、数据结构

2. **使用示例文档**
   - 文件: `docs/03-功能实现/Gmail操作使用示例.md`
   - 内容: Vue 组件中的实际使用示例、完整代码

3. **之前的相关文档**
   - `docs/03-功能实现/Gmail邮件拉取API集成.md` - 邮件拉取
   - `docs/04-问题修复/OAuth2令牌自动刷新机制.md` - 令牌管理
   - `docs/04-问题修复/Gmail API文件夹同步集成.md` - 文件夹同步

---

## 🎉 总结

本次开发成功实现了 Gmail 邮件的完整操作功能：

- ✅ **11 个邮件操作方法**（发送、回复、删除、标记等）
- ✅ **智能路由系统**（Gmail API 或 SMTP/IMAP）
- ✅ **RFC 2822 标准**（严格遵循邮件格式）
- ✅ **邮件线程保持**（回复时自动处理）
- ✅ **OAuth2 令牌管理**（自动刷新，提前 5 分钟）
- ✅ **完整的错误处理**（用户友好的错误提示）
- ✅ **详细的文档**（技术文档 + 使用示例）

所有功能全部使用 Google API 实现，操作自动同步到 Gmail 服务器端，为用户提供完整的邮件管理体验。

---

**开发完成日期**: 2025-10-22  
**文档版本**: v1.0
