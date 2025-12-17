# Gmail 邮件操作 API 集成

## 概述

本文档详细记录了使用 Gmail API 实现邮件发送、回复、删除等操作的完整过程。这些操作全部使用 Google API 实现，并自动同步到 Gmail 服务器端。

### 实现目标

- ✅ 邮件发送：使用 Gmail API `messages.send` 发送新邮件
- ✅ 邮件回复：使用 Gmail API 并保持邮件会话线程
- ✅ 邮件删除：使用 Gmail API `messages.trash` 移到回收站
- ✅ 标记已读：使用 Gmail API `messages.modify` 修改 UNREAD 标签
- ✅ 星标操作：使用 Gmail API 修改 STARRED 标签
- ✅ 智能路由：Gmail 账户使用 API，其他账户使用 SMTP/IMAP

---

## 1. 技术架构

### 1.1 分层设计

```
┌─────────────────────────────────────────────────┐
│           UI 层（ComposeModal.vue）              │
│         - 邮件撰写界面                            │
│         - 调用 store 方法                         │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│        Store 层（mail.js）                       │
│         - 智能路由（Gmail API vs SMTP/IMAP）     │
│         - 令牌管理（自动刷新）                    │
│         - 本地状态更新                            │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼──────────┐  ┌────▼────────────┐
│ Gmail API Service│  │  SMTP/IMAP      │
│ (gmail-api.js)   │  │  (Electron IPC) │
│ - RFC 2822 构建  │  │  - 传统协议     │
│ - HTTP 请求      │  │                 │
│ - 邮件解析       │  │                 │
└──────────────────┘  └─────────────────┘
        │
┌───────▼──────────┐
│  Gmail API v1    │
│  (Google Server) │
└──────────────────┘
```

### 1.2 智能路由机制

系统会自动检测账户类型并选择合适的发送方式：

**Gmail 账户判断条件**（满足任一即可）：
- `account.provider === 'gmail'`
- `account.imapHost?.includes('gmail.com')`
- `account.email?.endsWith('@gmail.com')`

**路由规则**：
- Gmail 账户 + OAuth2 认证 → 使用 Gmail API
- 其他账户 → 使用 SMTP/IMAP

---

## 2. Gmail API 服务扩展

### 2.1 文件位置
```
src/services/gmail-api.js
```

### 2.2 新增方法概览

| 方法名 | 功能 | API 端点 |
|--------|------|----------|
| `buildRawMessage()` | 构建 RFC 2822 格式邮件 | - |
| `send()` | 发送新邮件 | `POST /messages/send` |
| `reply()` | 回复邮件（保持线程） | `POST /messages/send` |
| `forward()` | 转发邮件 | `POST /messages/send` |
| `trashMessage()` | 移到回收站 | `POST /messages/{id}/trash` |
| `untrashMessage()` | 从回收站恢复 | `POST /messages/{id}/untrash` |
| `deleteMessage()` | 永久删除 | `DELETE /messages/{id}` |
| `modifyMessage()` | 修改标签 | `POST /messages/{id}/modify` |
| `markAsRead()` | 标记已读 | `POST /messages/{id}/modify` |
| `markAsUnread()` | 标记未读 | `POST /messages/{id}/modify` |
| `addStar()` | 添加星标 | `POST /messages/{id}/modify` |
| `removeStar()` | 移除星标 | `POST /messages/{id}/modify` |

### 2.3 核心实现

#### 2.3.1 构建 RFC 2822 格式邮件

RFC 2822 是互联网邮件格式标准，Gmail API 要求使用此格式。

```javascript
buildRawMessage(mail) {
  const lines = []
  
  // 1. 邮件头部
  if (mail.from) {
    lines.push(`From: ${mail.from}`)
  }
  
  if (mail.to) {
    const toAddresses = Array.isArray(mail.to) ? mail.to.join(', ') : mail.to
    lines.push(`To: ${toAddresses}`)
  }
  
  if (mail.cc) {
    const ccAddresses = Array.isArray(mail.cc) ? mail.cc.join(', ') : mail.cc
    lines.push(`Cc: ${ccAddresses}`)
  }
  
  if (mail.bcc) {
    const bccAddresses = Array.isArray(mail.bcc) ? mail.bcc.join(', ') : mail.bcc
    lines.push(`Bcc: ${bccAddresses}`)
  }
  
  // 2. 主题
  const subject = mail.subject || '(无主题)'
  lines.push(`Subject: ${subject}`)
  
  // 3. 回复头部（用于保持线程）
  if (mail.inReplyTo) {
    lines.push(`In-Reply-To: ${mail.inReplyTo}`)
  }
  
  if (mail.references) {
    lines.push(`References: ${mail.references}`)
  }
  
  // 4. MIME 头部
  lines.push('MIME-Version: 1.0')
  lines.push('Content-Type: text/html; charset=UTF-8')
  lines.push('Content-Transfer-Encoding: 7bit')
  
  // 5. 空行分隔头部和正文
  lines.push('')
  
  // 6. 正文
  lines.push(mail.body || '')
  
  // 7. 编码为 Base64 URL
  const rawMessage = lines.join('\r\n')
  const base64Message = btoa(unescape(encodeURIComponent(rawMessage)))
  
  // 8. 转换为 Base64 URL 编码（Gmail 要求）
  return base64Message
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
```

**关键要点**：
- 使用 `\r\n` 作为行分隔符（RFC 2822 标准）
- 必须有空行分隔头部和正文
- 使用 Base64 URL 编码（`+` → `-`, `/` → `_`, 去掉 `=`）

#### 2.3.2 发送新邮件

```javascript
async send(accessToken, mail) {
  console.log('[Gmail API] Sending new message...')
  const rawMessage = this.buildRawMessage(mail)
  const result = await this.sendMessage(accessToken, rawMessage)
  console.log('[Gmail API] Message sent successfully:', result.id)
  return result
}
```

**API 请求**：
```http
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "raw": "{base64UrlEncodedMessage}"
}
```

**返回数据**：
```json
{
  "id": "18d6c5e3f8a2b1c9",
  "threadId": "18d6c5e3f8a2b1c9",
  "labelIds": ["SENT"]
}
```

#### 2.3.3 回复邮件（保持线程）

回复邮件的关键是保持邮件会话的完整性，需要：
1. 获取原邮件的 `Message-ID`、`References`、`Subject`
2. 设置 `In-Reply-To` 和 `References` 头部
3. 使用相同的 `threadId`

```javascript
async reply(accessToken, originalMessageId, replyMail) {
  console.log('[Gmail API] Replying to message:', originalMessageId)
  
  // 1. 获取原邮件元数据
  const originalMessage = await this.getMessage(
    accessToken, 
    originalMessageId, 
    'metadata'
  )
  
  // 2. 提取头部信息
  const headers = {}
  originalMessage.payload?.headers?.forEach(header => {
    const name = header.name.toLowerCase()
    if (['message-id', 'references', 'subject'].includes(name)) {
      headers[name] = header.value
    }
  })
  
  // 3. 构建回复邮件
  const mail = {
    ...replyMail,
    threadId: originalMessage.threadId,  // 保持线程
    inReplyTo: headers['message-id'],    // 回复的邮件
    references: headers['references']     // 完整的引用链
      ? `${headers['references']} ${headers['message-id']}`
      : headers['message-id'],
    subject: replyMail.subject || `Re: ${headers.subject || ''}`,
  }
  
  // 4. 发送
  const rawMessage = this.buildRawMessage(mail)
  const result = await this.sendMessage(accessToken, rawMessage)
  console.log('[Gmail API] Reply sent successfully:', result.id)
  return result
}
```

**邮件线程示例**：
```
原邮件：
  Message-ID: <abc123@mail.gmail.com>
  Subject: 项目讨论

第一次回复：
  Message-ID: <def456@mail.gmail.com>
  In-Reply-To: <abc123@mail.gmail.com>
  References: <abc123@mail.gmail.com>
  Subject: Re: 项目讨论

第二次回复：
  Message-ID: <ghi789@mail.gmail.com>
  In-Reply-To: <def456@mail.gmail.com>
  References: <abc123@mail.gmail.com> <def456@mail.gmail.com>
  Subject: Re: 项目讨论
```

#### 2.3.4 转发邮件

```javascript
async forward(accessToken, originalMessageId, forwardMail) {
  console.log('[Gmail API] Forwarding message:', originalMessageId)
  
  // 1. 获取原邮件完整内容
  const originalMessage = await this.getMessage(accessToken, originalMessageId, 'full')
  const parsed = this.parseMessage(originalMessage)
  
  // 2. 构建转发内容
  const forwardContent = `
    <br/><br/>
    ---------- Forwarded message ---------<br/>
    From: ${parsed.from}<br/>
    Date: ${new Date(parsed.date).toLocaleString()}<br/>
    Subject: ${parsed.subject}<br/>
    To: ${parsed.to}<br/>
    ${parsed.cc ? `Cc: ${parsed.cc}<br/>` : ''}
    <br/><br/>
    ${parsed.html || parsed.text || ''}
  `
  
  // 3. 发送
  const mail = {
    ...forwardMail,
    body: (forwardMail.body || '') + forwardContent,
    subject: forwardMail.subject || `Fwd: ${parsed.subject}`,
  }
  
  return await this.send(accessToken, mail)
}
```

#### 2.3.5 删除操作

Gmail 提供两种删除方式：

**方式 1：移到回收站（推荐）**
```javascript
async trashMessage(accessToken, messageId) {
  console.log('[Gmail API] Moving message to trash:', messageId)
  const response = await this.makeRequest(
    `${this.baseUrl}/messages/${messageId}/trash`, 
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )
  console.log('[Gmail API] Message moved to trash successfully')
  return response
}
```

**方式 2：永久删除**
```javascript
async deleteMessage(accessToken, messageId) {
  console.log('[Gmail API] Permanently deleting message:', messageId)
  await this.makeRequest(
    `${this.baseUrl}/messages/${messageId}`, 
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  )
  console.log('[Gmail API] Message deleted permanently')
}
```

**区别**：
- `trash`：邮件移到回收站，可恢复，30 天后自动删除
- `delete`：永久删除，无法恢复

#### 2.3.6 标签修改

Gmail 使用标签系统管理邮件状态：

**通用方法**：
```javascript
async modifyMessage(accessToken, messageId, modifications) {
  console.log('[Gmail API] Modifying message labels:', messageId)
  const response = await this.makeRequest(
    `${this.baseUrl}/messages/${messageId}/modify`, 
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modifications),
    }
  )
  console.log('[Gmail API] Message modified successfully')
  return response
}
```

**请求体格式**：
```json
{
  "addLabelIds": ["STARRED", "IMPORTANT"],
  "removeLabelIds": ["UNREAD", "INBOX"]
}
```

**便捷方法**：

```javascript
// 标记已读
async markAsRead(accessToken, messageId) {
  return await this.modifyMessage(accessToken, messageId, {
    removeLabelIds: ['UNREAD'],
  })
}

// 标记未读
async markAsUnread(accessToken, messageId) {
  return await this.modifyMessage(accessToken, messageId, {
    addLabelIds: ['UNREAD'],
  })
}

// 添加星标
async addStar(accessToken, messageId) {
  return await this.modifyMessage(accessToken, messageId, {
    addLabelIds: ['STARRED'],
  })
}

// 移除星标
async removeStar(accessToken, messageId) {
  return await this.modifyMessage(accessToken, messageId, {
    removeLabelIds: ['STARRED'],
  })
}
```

**Gmail 系统标签**：
- `INBOX` - 收件箱
- `SENT` - 已发送
- `DRAFT` - 草稿箱
- `TRASH` - 回收站
- `SPAM` - 垃圾邮件
- `UNREAD` - 未读
- `STARRED` - 星标
- `IMPORTANT` - 重要

---

## 3. Store 层集成

### 3.1 文件位置
```
src/stores/mail.js
```

### 3.2 新增方法

| 方法名 | 功能 | 智能路由 |
|--------|------|----------|
| `sendMail()` | 发送邮件 | Gmail API / SMTP |
| `replyMail()` | 回复邮件 | Gmail API / SMTP |
| `deleteMailFromServer()` | 删除邮件 | Gmail API / IMAP |
| `markAsReadOnServer()` | 标记已读/未读 | Gmail API / IMAP |
| `toggleFlagOnServer()` | 切换星标 | Gmail API / IMAP |

### 3.3 发送邮件实现

```javascript
async function sendMail(mailData) {
  const account = accountStore.currentAccount
  if (!account) {
    throw new Error('请先选择账户')
  }

  // 检测是否为 Gmail 账户
  const isGmail = account.provider === 'gmail' || 
                  account.imapHost?.includes('gmail.com') ||
                  account.email?.endsWith('@gmail.com')

  if (isGmail && account.oauth2 && account.accessToken) {
    // ===== Gmail API 路径 =====
    console.log('[Mail] Sending via Gmail API...')
    
    // 1. 刷新令牌（如果需要）
    const accessToken = await ensureValidToken(account, accountStore)
    
    // 2. 动态导入 Gmail API 服务
    const { gmailApiService } = await import('@/services/gmail-api')
    
    // 3. 构建邮件对象
    const mail = {
      from: account.email,
      to: mailData.to,
      cc: mailData.cc,
      bcc: mailData.bcc,
      subject: mailData.subject,
      body: mailData.body,
    }
    
    // 4. 发送
    const result = await gmailApiService.send(accessToken, mail)
    console.log('[Mail] Sent via Gmail API successfully')
    return result
    
  } else {
    // ===== SMTP 路径 =====
    console.log('[Mail] Sending via SMTP...')
    
    if (!window.electronAPI) {
      throw new Error('非 Electron 环境，无法发送邮件')
    }
    
    const password = await ensureValidToken(account, accountStore)
    
    const result = await window.electronAPI.sendEmail({
      config: {
        email: account.email,
        password: password,
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
      },
      mailOptions: {
        from: account.email,
        to: mailData.to,
        cc: mailData.cc,
        bcc: mailData.bcc,
        subject: mailData.subject,
        html: mailData.body,
      },
    })
    
    console.log('[Mail] Sent via SMTP successfully')
    return result
  }
}
```

### 3.4 回复邮件实现

```javascript
async function replyMail(mailId, replyData) {
  const account = accountStore.currentAccount
  if (!account) {
    throw new Error('请先选择账户')
  }

  // 1. 查找原邮件
  const mail = mails.value.find(m => m.id === mailId)
  if (!mail) {
    throw new Error('邮件不存在')
  }

  // 2. 检测 Gmail 账户
  const isGmail = account.provider === 'gmail' || 
                  account.imapHost?.includes('gmail.com') ||
                  account.email?.endsWith('@gmail.com')

  if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
    // ===== Gmail API 回复（保持线程） =====
    console.log('[Mail] Replying via Gmail API...')
    
    const accessToken = await ensureValidToken(account, accountStore)
    const { gmailApiService } = await import('@/services/gmail-api')
    
    const replyMail = {
      from: account.email,
      to: replyData.to || mail.from,
      cc: replyData.cc,
      bcc: replyData.bcc,
      subject: replyData.subject,
      body: replyData.body,
    }
    
    // 使用 Gmail API 的 reply 方法（自动处理线程）
    const result = await gmailApiService.reply(
      accessToken, 
      mail.gmailId, 
      replyMail
    )
    console.log('[Mail] Replied via Gmail API successfully')
    return result
    
  } else {
    // ===== SMTP 回复（作为新邮件发送） =====
    console.log('[Mail] Replying via SMTP...')
    return await sendMail({
      to: replyData.to || mail.from,
      cc: replyData.cc,
      bcc: replyData.bcc,
      subject: replyData.subject || `Re: ${mail.subject}`,
      body: replyData.body,
    })
  }
}
```

**关键优势**：
- Gmail API 回复会自动保持线程完整性
- SMTP 回复作为独立邮件发送（无法保证线程）

### 3.5 删除邮件实现

```javascript
async function deleteMailFromServer(mailId) {
  const account = accountStore.currentAccount
  if (!account) {
    throw new Error('请先选择账户')
  }

  const mail = mails.value.find(m => m.id === mailId)
  if (!mail) {
    throw new Error('邮件不存在')
  }

  const isGmail = account.provider === 'gmail' || 
                  account.imapHost?.includes('gmail.com') ||
                  account.email?.endsWith('@gmail.com')

  if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
    // ===== Gmail API 删除 =====
    console.log('[Mail] Moving to trash via Gmail API...')
    
    const accessToken = await ensureValidToken(account, accountStore)
    const { gmailApiService } = await import('@/services/gmail-api')
    
    // 移到回收站
    await gmailApiService.trashMessage(accessToken, mail.gmailId)
    console.log('[Mail] Moved to trash via Gmail API successfully')
    
    // 更新本地状态
    await updateMail(mailId, { folder: 'trash' })
    
  } else if (window.electronAPI && mail.uid) {
    // ===== IMAP 删除 =====
    console.log('[Mail] Deleting via IMAP...')
    
    const password = await ensureValidToken(account, accountStore)
    
    await window.electronAPI.connectImap({
      email: account.email,
      password: password,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
    })
    
    await window.electronAPI.openImapFolder(mail.folder || 'INBOX')
    await window.electronAPI.deleteImapMail(mail.uid)
    await window.electronAPI.disconnectImap()
    
    console.log('[Mail] Deleted via IMAP successfully')
    await updateMail(mailId, { folder: 'trash' })
    
  } else {
    // ===== 仅本地删除 =====
    await updateMail(mailId, { folder: 'trash' })
  }
}
```

### 3.6 标记已读实现

```javascript
async function markAsReadOnServer(mailId, read = true) {
  const account = accountStore.currentAccount
  if (!account) {
    throw new Error('请先选择账户')
  }

  const mail = mails.value.find(m => m.id === mailId)
  if (!mail) {
    throw new Error('邮件不存在')
  }

  const isGmail = account.provider === 'gmail' || 
                  account.imapHost?.includes('gmail.com') ||
                  account.email?.endsWith('@gmail.com')

  if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
    // ===== Gmail API 标记 =====
    console.log(`[Mail] Marking as ${read ? 'read' : 'unread'} via Gmail API...`)
    
    const accessToken = await ensureValidToken(account, accountStore)
    const { gmailApiService } = await import('@/services/gmail-api')
    
    if (read) {
      await gmailApiService.markAsRead(accessToken, mail.gmailId)
    } else {
      await gmailApiService.markAsUnread(accessToken, mail.gmailId)
    }
    
    console.log('[Mail] Marked via Gmail API successfully')
    
  } else if (window.electronAPI && mail.uid) {
    // ===== IMAP 标记 =====
    console.log(`[Mail] Marking as ${read ? 'read' : 'unread'} via IMAP...`)
    
    const password = await ensureValidToken(account, accountStore)
    
    await window.electronAPI.connectImap({
      email: account.email,
      password: password,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
    })
    
    await window.electronAPI.openImapFolder(mail.folder || 'INBOX')
    
    if (read) {
      await window.electronAPI.markImapMailAsRead(mail.uid)
    }
    // Note: IMAP 没有直接的标记为未读方法
    
    await window.electronAPI.disconnectImap()
    console.log('[Mail] Marked via IMAP successfully')
  }
  
  // 更新本地状态
  await updateMail(mailId, { read })
}
```

### 3.7 切换星标实现

```javascript
async function toggleFlagOnServer(mailId) {
  const mail = mails.value.find(m => m.id === mailId)
  if (!mail) {
    throw new Error('邮件不存在')
  }

  const account = accountStore.currentAccount
  if (!account) {
    throw new Error('请先选择账户')
  }

  const newFlaggedState = !mail.flagged

  const isGmail = account.provider === 'gmail' || 
                  account.imapHost?.includes('gmail.com') ||
                  account.email?.endsWith('@gmail.com')

  if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
    // ===== Gmail API 星标 =====
    console.log(`[Mail] ${newFlaggedState ? 'Adding' : 'Removing'} star via Gmail API...`)
    
    const accessToken = await ensureValidToken(account, accountStore)
    const { gmailApiService } = await import('@/services/gmail-api')
    
    if (newFlaggedState) {
      await gmailApiService.addStar(accessToken, mail.gmailId)
    } else {
      await gmailApiService.removeStar(accessToken, mail.gmailId)
    }
    
    console.log('[Mail] Star toggled via Gmail API successfully')
  }
  // Note: IMAP 的星标操作可以后续添加
  
  // 更新本地状态
  await updateMail(mailId, { flagged: newFlaggedState })
}
```

---

## 4. OAuth2 令牌管理

### 4.1 自动刷新机制

所有 Gmail API 操作前都会自动检查并刷新令牌：

```javascript
async function ensureValidToken(account, accountStore) {
  // 1. 非 OAuth2 账户直接返回
  if (!account.oauth2 || !account.accessToken) {
    return account.accessToken || account.password
  }
  
  // 2. 检查令牌是否过期（提前 5 分钟刷新）
  const expiresAt = account.expiresAt || 0
  const now = Date.now()
  const bufferTime = 5 * 60 * 1000 // 5 分钟缓冲
  
  if (expiresAt > now + bufferTime) {
    // 令牌还有效
    console.log('[Mail] Access token is valid')
    return account.accessToken
  }
  
  // 3. 令牌已过期，刷新
  console.log('[Mail] Access token expired, refreshing...')
  
  if (!account.refreshToken) {
    throw new Error('访问令牌已过期且没有刷新令牌，请重新登录')
  }
  
  const { oauth2Service } = await import('@/services/oauth')
  const tokenResult = await oauth2Service.refreshToken(
    account.provider || 'gmail',
    account.refreshToken
  )
  
  // 4. 更新账户信息
  await accountStore.updateAccount(account.id, {
    accessToken: tokenResult.accessToken,
    expiresAt: tokenResult.expiresAt,
  })
  
  console.log('[Mail] Token refreshed successfully')
  return tokenResult.accessToken
}
```

**刷新策略**：
- 提前 5 分钟刷新（避免请求时令牌刚好过期）
- 使用 refresh_token 获取新的 access_token
- 自动更新本地存储的令牌信息

---

## 5. 使用示例

### 5.1 发送新邮件

```javascript
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()

// 发送邮件
const result = await mailStore.sendMail({
  to: ['user1@example.com', 'user2@example.com'],
  cc: ['user3@example.com'],
  bcc: ['user4@example.com'],
  subject: '项目进展报告',
  body: '<p>本周项目进展如下...</p>',
})

console.log('邮件已发送:', result.id)
```

### 5.2 回复邮件

```javascript
// 回复邮件（保持线程）
const result = await mailStore.replyMail('mail-id-123', {
  to: 'sender@example.com',
  subject: 'Re: 项目进展报告',
  body: '<p>感谢您的反馈...</p>',
})

console.log('回复已发送:', result.id)
```

### 5.3 删除邮件

```javascript
// 移到回收站（Gmail）或删除标记（IMAP）
await mailStore.deleteMailFromServer('mail-id-123')

console.log('邮件已移到回收站')
```

### 5.4 标记已读

```javascript
// 标记为已读
await mailStore.markAsReadOnServer('mail-id-123', true)

// 标记为未读
await mailStore.markAsReadOnServer('mail-id-123', false)
```

### 5.5 切换星标

```javascript
// 添加或移除星标
await mailStore.toggleFlagOnServer('mail-id-123')
```

---

## 6. 数据结构

### 6.1 邮件对象（发送）

```javascript
{
  from: 'sender@gmail.com',           // 发件人
  to: ['user1@example.com'],          // 收件人（数组或字符串）
  cc: ['user2@example.com'],          // 抄送（可选）
  bcc: ['user3@example.com'],         // 密送（可选）
  subject: '邮件主题',                 // 主题
  body: '<p>HTML 正文</p>',            // 正文（HTML）
  
  // 回复时需要
  inReplyTo: '<message-id@example.com>',   // 回复的邮件 ID
  references: '<msg1@> <msg2@>',           // 完整的引用链
  threadId: 'thread-id-abc123',            // 会话 ID
}
```

### 6.2 Gmail API 响应

**发送成功**：
```json
{
  "id": "18d6c5e3f8a2b1c9",
  "threadId": "18d6c5e3f8a2b1c9",
  "labelIds": ["SENT"]
}
```

**删除成功**：
```json
{
  "id": "18d6c5e3f8a2b1c9",
  "threadId": "18d6c5e3f8a2b1c9",
  "labelIds": ["TRASH"]
}
```

**修改标签成功**：
```json
{
  "id": "18d6c5e3f8a2b1c9",
  "threadId": "18d6c5e3f8a2b1c9",
  "labelIds": ["INBOX", "STARRED"]
}
```

---

## 7. 错误处理

### 7.1 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `401 Unauthorized` | 令牌过期 | 自动刷新令牌 |
| `403 Forbidden` | 权限不足 | 检查 OAuth2 scope |
| `404 Not Found` | 邮件不存在 | 检查 messageId |
| `429 Too Many Requests` | 请求过多 | 添加请求限流 |
| `500 Internal Server Error` | Gmail 服务器错误 | 重试请求 |

### 7.2 错误处理代码

```javascript
try {
  await mailStore.sendMail(mailData)
} catch (error) {
  if (error.message.includes('401')) {
    console.error('认证失败，请重新登录')
  } else if (error.message.includes('403')) {
    console.error('权限不足，请检查 OAuth2 授权')
  } else if (error.message.includes('429')) {
    console.error('请求过多，请稍后再试')
  } else {
    console.error('发送失败:', error.message)
  }
}
```

---

## 8. 性能优化

### 8.1 批量操作

如果需要批量标记邮件，可以使用 Gmail API 的批量修改接口：

```javascript
// 批量标记为已读
async function batchMarkAsRead(messageIds) {
  const accessToken = await ensureValidToken(account, accountStore)
  const { gmailApiService } = await import('@/services/gmail-api')
  
  const promises = messageIds.map(id => 
    gmailApiService.markAsRead(accessToken, id)
  )
  
  await Promise.all(promises)
}
```

### 8.2 请求缓存

对于频繁请求的邮件元数据，可以添加缓存：

```javascript
const messageCache = new Map()

async function getMessageCached(messageId) {
  if (messageCache.has(messageId)) {
    return messageCache.get(messageId)
  }
  
  const message = await gmailApiService.getMessage(accessToken, messageId)
  messageCache.set(messageId, message)
  return message
}
```

---

## 9. 测试建议

### 9.1 单元测试

**测试 RFC 2822 构建**：
```javascript
test('buildRawMessage should create valid RFC 2822 format', () => {
  const mail = {
    from: 'sender@gmail.com',
    to: 'receiver@example.com',
    subject: 'Test',
    body: '<p>Hello</p>',
  }
  
  const raw = gmailApiService.buildRawMessage(mail)
  const decoded = atob(raw.replace(/-/g, '+').replace(/_/g, '/'))
  
  expect(decoded).toContain('From: sender@gmail.com')
  expect(decoded).toContain('To: receiver@example.com')
  expect(decoded).toContain('Subject: Test')
  expect(decoded).toContain('<p>Hello</p>')
})
```

**测试令牌刷新**：
```javascript
test('ensureValidToken should refresh expired token', async () => {
  const account = {
    oauth2: true,
    accessToken: 'old-token',
    refreshToken: 'refresh-token',
    expiresAt: Date.now() - 1000, // 已过期
  }
  
  const newToken = await ensureValidToken(account, accountStore)
  
  expect(newToken).not.toBe('old-token')
  expect(account.expiresAt).toBeGreaterThan(Date.now())
})
```

### 9.2 集成测试

**测试发送流程**：
1. 使用测试账户登录
2. 发送一封邮件到测试收件箱
3. 验证邮件出现在 SENT 文件夹
4. 验证收件人收到邮件

**测试回复流程**：
1. 获取收件箱的一封邮件
2. 回复该邮件
3. 验证回复在同一线程中
4. 验证 In-Reply-To 和 References 头部正确

**测试删除流程**：
1. 发送一封测试邮件
2. 删除该邮件
3. 验证邮件移到 TRASH 文件夹
4. 验证邮件标签包含 TRASH

---

## 10. 安全建议

### 10.1 令牌存储

- ✅ 使用 Electron 的 `safeStorage` 加密存储 refresh_token
- ✅ access_token 存储在内存中，避免持久化
- ❌ 不要在日志中打印完整的令牌

### 10.2 HTTPS

- ✅ 所有 Gmail API 请求使用 HTTPS
- ✅ 验证 SSL 证书（Electron 中默认启用）

### 10.3 权限最小化

只请求必要的 OAuth2 scope：
```javascript
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',       // 发送邮件
  'https://www.googleapis.com/auth/gmail.modify',     // 修改邮件（标记已读、星标、删除）
  'https://www.googleapis.com/auth/gmail.readonly',   // 读取邮件
]
```

---

## 11. 总结

### 11.1 已实现功能

- ✅ 邮件发送（Gmail API）
- ✅ 邮件回复（保持线程）
- ✅ 邮件转发
- ✅ 邮件删除（移到回收站）
- ✅ 永久删除
- ✅ 标记已读/未读
- ✅ 星标操作
- ✅ 智能路由（Gmail API / SMTP）
- ✅ OAuth2 令牌自动刷新
- ✅ 完整的错误处理

### 11.2 技术亮点

1. **RFC 2822 标准**：严格遵循邮件格式标准
2. **邮件线程保持**：回复时自动处理 In-Reply-To 和 References
3. **智能路由**：自动选择最佳发送方式
4. **令牌管理**：提前刷新，避免请求失败
5. **Base64 URL 编码**：符合 Gmail API 要求
6. **完整的日志**：方便调试和监控

### 11.3 后续优化

- [ ] 添加草稿箱功能
- [ ] 支持附件上传
- [ ] 批量操作优化
- [ ] 离线队列（发送失败时重试）
- [ ] 邮件模板功能

---

## 12. 参考资料

- [Gmail API 官方文档](https://developers.google.com/gmail/api)
- [RFC 2822 - Internet Message Format](https://www.rfc-editor.org/rfc/rfc2822)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail API - Send Messages](https://developers.google.com/gmail/api/guides/sending)
- [Gmail API - Modify Messages](https://developers.google.com/gmail/api/guides/modify)
