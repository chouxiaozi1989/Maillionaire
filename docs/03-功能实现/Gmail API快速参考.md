# Gmail API 快速参考

## 方法速查表

### Store 方法 (mail.js)

在 Vue 组件中使用：

```javascript
import { useMailStore } from '@/stores/mail'
const mailStore = useMailStore()
```

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `sendMail(mailData)` | `{ to, cc, bcc, subject, body }` | `Promise<Object>` | 发送新邮件 |
| `replyMail(mailId, replyData)` | `mailId: string`<br/>`replyData: { to?, subject?, body }` | `Promise<Object>` | 回复邮件 |
| `deleteMailFromServer(mailId)` | `mailId: string` | `Promise<void>` | 删除邮件 |
| `markAsReadOnServer(mailId, read)` | `mailId: string`<br/>`read: boolean` | `Promise<void>` | 标记已读/未读 |
| `toggleFlagOnServer(mailId)` | `mailId: string` | `Promise<void>` | 切换星标 |

### Gmail API 方法 (gmail-api.js)

低级 API，一般不直接使用：

| 方法 | Gmail API 端点 | 说明 |
|------|---------------|------|
| `send(accessToken, mail)` | `POST /messages/send` | 发送邮件 |
| `reply(accessToken, msgId, mail)` | `POST /messages/send` | 回复邮件 |
| `forward(accessToken, msgId, mail)` | `POST /messages/send` | 转发邮件 |
| `trashMessage(accessToken, msgId)` | `POST /messages/{id}/trash` | 移到回收站 |
| `untrashMessage(accessToken, msgId)` | `POST /messages/{id}/untrash` | 恢复邮件 |
| `deleteMessage(accessToken, msgId)` | `DELETE /messages/{id}` | 永久删除 |
| `modifyMessage(accessToken, msgId, mods)` | `POST /messages/{id}/modify` | 修改标签 |
| `markAsRead(accessToken, msgId)` | `POST /messages/{id}/modify` | 标记已读 |
| `markAsUnread(accessToken, msgId)` | `POST /messages/{id}/modify` | 标记未读 |
| `addStar(accessToken, msgId)` | `POST /messages/{id}/modify` | 添加星标 |
| `removeStar(accessToken, msgId)` | `POST /messages/{id}/modify` | 移除星标 |

---

## 常用代码片段

### 1. 发送邮件

```javascript
// 基础发送
await mailStore.sendMail({
  to: 'user@example.com',
  subject: '邮件主题',
  body: '<p>邮件内容</p>',
})

// 多个收件人 + 抄送
await mailStore.sendMail({
  to: ['user1@example.com', 'user2@example.com'],
  cc: ['manager@example.com'],
  bcc: ['archive@example.com'],
  subject: '项目报告',
  body: '<h1>报告</h1><p>内容...</p>',
})
```

### 2. 回复邮件

```javascript
// 基础回复（自动保持线程）
await mailStore.replyMail('mail-id-123', {
  body: '<p>感谢您的来信...</p>',
})

// 自定义收件人和主题
await mailStore.replyMail('mail-id-123', {
  to: 'custom@example.com',
  subject: 'Re: 自定义主题',
  body: '<p>回复内容...</p>',
})
```

### 3. 删除邮件

```javascript
// 单个删除
await mailStore.deleteMailFromServer('mail-id-123')

// 批量删除
const mailIds = ['id1', 'id2', 'id3']
await Promise.all(mailIds.map(id => 
  mailStore.deleteMailFromServer(id)
))
```

### 4. 标记已读

```javascript
// 标记为已读
await mailStore.markAsReadOnServer('mail-id-123', true)

// 标记为未读
await mailStore.markAsReadOnServer('mail-id-123', false)

// 打开邮件时自动标记
function openMail(mail) {
  showDetail(mail)
  if (!mail.read) {
    mailStore.markAsReadOnServer(mail.id, true)
  }
}
```

### 5. 星标操作

```javascript
// 切换星标
await mailStore.toggleFlagOnServer('mail-id-123')
```

---

## 完整示例：写邮件弹窗

```vue
<template>
  <a-modal 
    v-model:visible="visible"
    title="写邮件"
    @ok="handleSend"
    :confirmLoading="sending"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="收件人" required>
        <a-select
          v-model:value="form.to"
          mode="tags"
          placeholder="输入邮箱地址"
        />
      </a-form-item>
      
      <a-form-item label="主题" required>
        <a-input v-model:value="form.subject" />
      </a-form-item>
      
      <a-form-item label="正文">
        <a-textarea 
          v-model:value="form.body" 
          :rows="10"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()
const visible = ref(false)
const sending = ref(false)

const form = reactive({
  to: [],
  subject: '',
  body: '',
})

async function handleSend() {
  if (!form.to.length || !form.subject) {
    message.warning('请填写收件人和主题')
    return
  }
  
  sending.value = true
  
  try {
    await mailStore.sendMail({
      to: form.to,
      subject: form.subject,
      body: form.body,
    })
    
    message.success('邮件发送成功')
    visible.value = false
    
    // 清空表单
    form.to = []
    form.subject = ''
    form.body = ''
  } catch (error) {
    message.error(`发送失败: ${error.message}`)
  } finally {
    sending.value = false
  }
}
</script>
```

---

## 完整示例：邮件详情弹窗

```vue
<template>
  <a-modal 
    v-model:visible="visible"
    :title="mail?.subject"
    width="800px"
    :footer="null"
  >
    <div class="mail-detail">
      <!-- 邮件头部 -->
      <div class="mail-header">
        <div class="mail-meta">
          <p><strong>发件人:</strong> {{ mail?.from }}</p>
          <p><strong>收件人:</strong> {{ mail?.to }}</p>
          <p><strong>日期:</strong> {{ formatDate(mail?.date) }}</p>
        </div>
        
        <div class="mail-actions">
          <a-button @click="handleReply">回复</a-button>
          <a-button @click="toggleStar" :loading="starring">
            {{ mail?.flagged ? '取消星标' : '添加星标' }}
          </a-button>
          <a-button danger @click="handleDelete" :loading="deleting">
            删除
          </a-button>
        </div>
      </div>
      
      <!-- 邮件正文 -->
      <a-divider />
      <div class="mail-body" v-html="mail?.html || mail?.text"></div>
      
      <!-- 回复框 -->
      <div v-if="showReplyBox" class="reply-box">
        <a-divider>回复</a-divider>
        <a-textarea 
          v-model:value="replyContent" 
          :rows="6"
          placeholder="输入回复内容"
        />
        <div class="reply-actions">
          <a-button 
            type="primary" 
            @click="sendReply"
            :loading="replying"
          >
            发送回复
          </a-button>
          <a-button @click="showReplyBox = false">取消</a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useMailStore } from '@/stores/mail'

const props = defineProps({
  mail: Object,
})

const mailStore = useMailStore()
const visible = ref(false)
const showReplyBox = ref(false)
const replyContent = ref('')
const replying = ref(false)
const starring = ref(false)
const deleting = ref(false)

function handleReply() {
  showReplyBox.value = true
}

async function sendReply() {
  if (!replyContent.value) {
    message.warning('请输入回复内容')
    return
  }
  
  replying.value = true
  
  try {
    await mailStore.replyMail(props.mail.id, {
      body: replyContent.value,
    })
    
    message.success('回复发送成功')
    showReplyBox.value = false
    replyContent.value = ''
  } catch (error) {
    message.error(`回复失败: ${error.message}`)
  } finally {
    replying.value = false
  }
}

async function toggleStar() {
  starring.value = true
  
  try {
    await mailStore.toggleFlagOnServer(props.mail.id)
    message.success(props.mail.flagged ? '已移除星标' : '已添加星标')
  } catch (error) {
    message.error('星标操作失败')
  } finally {
    starring.value = false
  }
}

async function handleDelete() {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这封邮件吗？',
    onOk: async () => {
      deleting.value = true
      
      try {
        await mailStore.deleteMailFromServer(props.mail.id)
        message.success('邮件已删除')
        visible.value = false
      } catch (error) {
        message.error('删除失败')
      } finally {
        deleting.value = false
      }
    },
  })
}

function formatDate(date) {
  return new Date(date).toLocaleString('zh-CN')
}
</script>

<style scoped>
.mail-detail {
  padding: 16px 0;
}

.mail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.mail-meta p {
  margin: 8px 0;
}

.mail-actions {
  display: flex;
  gap: 8px;
}

.mail-body {
  padding: 16px;
  background: #f9f9f9;
  border-radius: 4px;
  min-height: 200px;
}

.reply-box {
  margin-top: 24px;
}

.reply-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
</style>
```

---

## 错误处理

```javascript
try {
  await mailStore.sendMail(mailData)
} catch (error) {
  // 根据错误类型处理
  if (error.message.includes('401')) {
    message.error('认证已过期，请重新登录')
    // 跳转到登录页
  } else if (error.message.includes('403')) {
    message.error('权限不足，请检查授权')
  } else if (error.message.includes('429')) {
    message.error('请求过多，请稍后再试')
  } else if (error.message.includes('网络')) {
    message.error('网络错误，请检查连接')
  } else {
    message.error(`操作失败: ${error.message}`)
  }
}
```

---

## 批量操作

```javascript
// 批量标记已读
async function batchMarkAsRead(mailIds) {
  const promises = mailIds.map(id => 
    mailStore.markAsReadOnServer(id, true)
  )
  
  try {
    await Promise.all(promises)
    message.success(`已标记 ${mailIds.length} 封邮件为已读`)
  } catch (error) {
    message.error('批量操作失败')
  }
}

// 批量删除
async function batchDelete(mailIds) {
  const confirmed = await Modal.confirm({
    title: '批量删除',
    content: `确定要删除 ${mailIds.length} 封邮件吗？`,
  })
  
  if (!confirmed) return
  
  const promises = mailIds.map(id => 
    mailStore.deleteMailFromServer(id)
  )
  
  try {
    await Promise.all(promises)
    message.success(`已删除 ${mailIds.length} 封邮件`)
  } catch (error) {
    message.error('批量删除失败')
  }
}
```

---

## 性能优化技巧

### 1. 防抖处理

```javascript
import { debounce } from 'lodash-es'

const debouncedMarkAsRead = debounce(async (mailId) => {
  await mailStore.markAsReadOnServer(mailId, true)
}, 500)

// 使用
onMailClick(mail) {
  showDetail(mail)
  if (!mail.read) {
    debouncedMarkAsRead(mail.id)
  }
}
```

### 2. 分批处理

```javascript
async function batchOperation(items, operation, batchSize = 5) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(item => operation(item)))
  }
}

// 使用
await batchOperation(
  mailIds,
  id => mailStore.markAsReadOnServer(id, true),
  10  // 每批 10 个
)
```

---

## 常见问题

### Q: 如何判断是否支持 Gmail API？

```javascript
const account = accountStore.currentAccount
const isGmail = 
  account.provider === 'gmail' || 
  account.imapHost?.includes('gmail.com') ||
  account.email?.endsWith('@gmail.com')

const canUseApi = isGmail && account.oauth2 && account.accessToken
```

### Q: 如何处理令牌过期？

系统会自动处理！每次 API 调用前都会检查并刷新令牌。如果刷新失败，会抛出错误提示用户重新登录。

### Q: 回复邮件时如何保持线程？

使用 `replyMail()` 方法会自动处理邮件线程，无需手动设置 `In-Reply-To` 等头部。

### Q: 删除邮件是永久删除吗？

不是。默认使用 `trashMessage()` 移到回收站，可以恢复。如需永久删除，需要直接调用 Gmail API 的 `deleteMessage()` 方法。

---

## 相关文档

- **技术实现**: `docs/03-功能实现/Gmail邮件操作API集成.md`
- **使用示例**: `docs/03-功能实现/Gmail操作使用示例.md`
- **功能总结**: `docs/03-功能实现/Gmail操作功能总结.md`
- **Gmail API 官方文档**: https://developers.google.com/gmail/api
