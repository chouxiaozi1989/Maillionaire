# Gmail 操作使用示例

本文档提供了在 Vue 组件中使用 Gmail API 邮件操作的完整示例。

---

## 1. 发送新邮件

### 1.1 基础发送

```vue
<template>
  <div class="compose-mail">
    <a-form :model="form" @submit="handleSend">
      <a-form-item label="收件人">
        <a-input v-model:value="form.to" placeholder="user@example.com" />
      </a-form-item>
      
      <a-form-item label="主题">
        <a-input v-model:value="form.subject" placeholder="邮件主题" />
      </a-form-item>
      
      <a-form-item label="正文">
        <a-textarea 
          v-model:value="form.body" 
          :rows="10" 
          placeholder="邮件内容"
        />
      </a-form-item>
      
      <a-button type="primary" html-type="submit" :loading="sending">
        发送
      </a-button>
    </a-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()

const sending = ref(false)
const form = reactive({
  to: '',
  subject: '',
  body: '',
})

async function handleSend() {
  if (!form.to || !form.subject) {
    message.warning('请填写收件人和主题')
    return
  }
  
  sending.value = true
  
  try {
    const result = await mailStore.sendMail({
      to: form.to,
      subject: form.subject,
      body: form.body,
    })
    
    message.success('邮件发送成功')
    console.log('发送结果:', result)
    
    // 清空表单
    form.to = ''
    form.subject = ''
    form.body = ''
  } catch (error) {
    console.error('发送失败:', error)
    message.error(`发送失败: ${error.message}`)
  } finally {
    sending.value = false
  }
}
</script>
```

### 1.2 发送给多个收件人（含抄送、密送）

```javascript
async function sendToMultiple() {
  try {
    const result = await mailStore.sendMail({
      to: ['user1@example.com', 'user2@example.com'],
      cc: ['manager@example.com'],
      bcc: ['archive@example.com'],
      subject: '项目进展报告',
      body: '<h1>项目进展</h1><p>本周工作总结...</p>',
    })
    
    message.success('邮件已发送给多个收件人')
  } catch (error) {
    message.error(`发送失败: ${error.message}`)
  }
}
```

### 1.3 发送 HTML 邮件

```javascript
async function sendHtmlMail() {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { background: #4CAF50; color: white; padding: 20px; }
        .content { padding: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>欢迎使用我们的服务</h1>
      </div>
      <div class="content">
        <p>您好，</p>
        <p>感谢您注册我们的服务！</p>
        <a href="https://example.com">访问网站</a>
      </div>
    </body>
    </html>
  `
  
  await mailStore.sendMail({
    to: 'user@example.com',
    subject: '欢迎注册',
    body: htmlContent,
  })
}
```

---

## 2. 回复邮件

### 2.1 基础回复

```vue
<template>
  <div class="reply-mail">
    <div class="original-mail">
      <h3>原邮件</h3>
      <p><strong>发件人:</strong> {{ mail.from }}</p>
      <p><strong>主题:</strong> {{ mail.subject }}</p>
      <div v-html="mail.html"></div>
    </div>
    
    <a-divider />
    
    <a-form :model="replyForm" @submit="handleReply">
      <a-form-item label="回复内容">
        <a-textarea 
          v-model:value="replyForm.body" 
          :rows="8" 
          placeholder="输入回复内容"
        />
      </a-form-item>
      
      <a-button type="primary" html-type="submit" :loading="replying">
        回复
      </a-button>
    </a-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { useMailStore } from '@/stores/mail'

const props = defineProps({
  mail: {
    type: Object,
    required: true,
  },
})

const mailStore = useMailStore()
const replying = ref(false)
const replyForm = reactive({
  body: '',
})

async function handleReply() {
  if (!replyForm.body) {
    message.warning('请输入回复内容')
    return
  }
  
  replying.value = true
  
  try {
    const result = await mailStore.replyMail(props.mail.id, {
      body: replyForm.body,
    })
    
    message.success('回复已发送')
    console.log('回复结果:', result)
    
    // 清空表单
    replyForm.body = ''
  } catch (error) {
    console.error('回复失败:', error)
    message.error(`回复失败: ${error.message}`)
  } finally {
    replying.value = false
  }
}
</script>
```

### 2.2 全部回复（包含原收件人和抄送）

```javascript
async function replyAll(mail) {
  // 提取所有收件人（排除自己）
  const myEmail = accountStore.currentAccount.email
  const allRecipients = [
    mail.from,
    ...(mail.to ? mail.to.split(',') : []),
    ...(mail.cc ? mail.cc.split(',') : []),
  ]
    .map(email => email.trim())
    .filter(email => email !== myEmail)
  
  const uniqueRecipients = [...new Set(allRecipients)]
  
  await mailStore.replyMail(mail.id, {
    to: uniqueRecipients[0],  // 原发件人
    cc: uniqueRecipients.slice(1),  // 其他人作为抄送
    subject: `Re: ${mail.subject}`,
    body: '<p>感谢大家的反馈...</p>',
  })
}
```

### 2.3 带引用的回复

```javascript
async function replyWithQuote(mail) {
  const quotedContent = `
    <br/><br/>
    <div style="border-left: 3px solid #ccc; padding-left: 10px; margin-left: 10px;">
      <p><strong>在 ${new Date(mail.date).toLocaleString()} ${mail.from} 写道:</strong></p>
      ${mail.html || mail.text || ''}
    </div>
  `
  
  await mailStore.replyMail(mail.id, {
    body: '<p>您好，</p><p>关于您的问题...</p>' + quotedContent,
  })
}
```

---

## 3. 删除邮件

### 3.1 单个删除

```vue
<template>
  <div class="mail-item">
    <span>{{ mail.subject }}</span>
    <a-button 
      danger 
      size="small" 
      @click="handleDelete"
      :loading="deleting"
    >
      删除
    </a-button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useMailStore } from '@/stores/mail'

const props = defineProps({
  mail: {
    type: Object,
    required: true,
  },
})

const mailStore = useMailStore()
const deleting = ref(false)

async function handleDelete() {
  // 确认删除
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这封邮件吗？',
    onOk: async () => {
      deleting.value = true
      
      try {
        await mailStore.deleteMailFromServer(props.mail.id)
        message.success('邮件已移到回收站')
      } catch (error) {
        console.error('删除失败:', error)
        message.error(`删除失败: ${error.message}`)
      } finally {
        deleting.value = false
      }
    },
  })
}
</script>
```

### 3.2 批量删除

```javascript
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()

async function batchDelete(mailIds) {
  const confirmResult = await Modal.confirm({
    title: '批量删除',
    content: `确定要删除 ${mailIds.length} 封邮件吗？`,
  })
  
  if (!confirmResult) return
  
  const results = []
  const errors = []
  
  for (const mailId of mailIds) {
    try {
      await mailStore.deleteMailFromServer(mailId)
      results.push(mailId)
    } catch (error) {
      console.error(`删除邮件 ${mailId} 失败:`, error)
      errors.push({ mailId, error })
    }
  }
  
  if (errors.length === 0) {
    message.success(`成功删除 ${results.length} 封邮件`)
  } else {
    message.warning(
      `删除完成：成功 ${results.length} 封，失败 ${errors.length} 封`
    )
  }
}
```

---

## 4. 标记已读/未读

### 4.1 切换已读状态

```vue
<template>
  <div class="mail-item" :class="{ unread: !mail.read }">
    <span>{{ mail.subject }}</span>
    <a-button 
      size="small" 
      @click="toggleRead"
      :loading="updating"
    >
      {{ mail.read ? '标记为未读' : '标记为已读' }}
    </a-button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { useMailStore } from '@/stores/mail'

const props = defineProps({
  mail: {
    type: Object,
    required: true,
  },
})

const mailStore = useMailStore()
const updating = ref(false)

async function toggleRead() {
  updating.value = true
  
  try {
    const newReadState = !props.mail.read
    await mailStore.markAsReadOnServer(props.mail.id, newReadState)
    
    message.success(newReadState ? '已标记为已读' : '已标记为未读')
  } catch (error) {
    console.error('标记失败:', error)
    message.error(`操作失败: ${error.message}`)
  } finally {
    updating.value = false
  }
}
</script>

<style scoped>
.unread {
  font-weight: bold;
}
</style>
```

### 4.2 打开邮件时自动标记为已读

```javascript
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()

async function openMail(mail) {
  // 打开邮件详情
  showMailDetail(mail)
  
  // 如果是未读邮件，标记为已读
  if (!mail.read) {
    try {
      await mailStore.markAsReadOnServer(mail.id, true)
    } catch (error) {
      console.error('自动标记已读失败:', error)
      // 不影响用户体验，静默失败
    }
  }
}
```

### 4.3 批量标记已读

```javascript
async function batchMarkAsRead(mailIds) {
  const promises = mailIds.map(mailId => 
    mailStore.markAsReadOnServer(mailId, true)
  )
  
  try {
    await Promise.all(promises)
    message.success(`已标记 ${mailIds.length} 封邮件为已读`)
  } catch (error) {
    message.error('批量标记失败')
  }
}
```

---

## 5. 星标操作

### 5.1 切换星标

```vue
<template>
  <div class="mail-item">
    <a-button 
      type="text" 
      @click="toggleStar"
      :loading="toggling"
    >
      <StarFilled v-if="mail.flagged" style="color: #fadb14" />
      <StarOutlined v-else />
    </a-button>
    <span>{{ mail.subject }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { StarFilled, StarOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useMailStore } from '@/stores/mail'

const props = defineProps({
  mail: {
    type: Object,
    required: true,
  },
})

const mailStore = useMailStore()
const toggling = ref(false)

async function toggleStar() {
  toggling.value = true
  
  try {
    await mailStore.toggleFlagOnServer(props.mail.id)
    
    const newState = !props.mail.flagged
    message.success(newState ? '已添加星标' : '已移除星标')
  } catch (error) {
    console.error('星标操作失败:', error)
    message.error(`操作失败: ${error.message}`)
  } finally {
    toggling.value = false
  }
}
</script>
```

### 5.2 显示星标邮件列表

```vue
<template>
  <div class="starred-mails">
    <h2>星标邮件</h2>
    <a-list :data-source="starredMails">
      <template #renderItem="{ item }">
        <a-list-item>
          <StarFilled style="color: #fadb14; margin-right: 8px" />
          <span>{{ item.subject }}</span>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { StarFilled } from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()

const starredMails = computed(() => {
  return mailStore.mails.filter(mail => mail.flagged)
})
</script>
```

---

## 6. 完整示例：邮件列表组件

```vue
<template>
  <div class="mail-list">
    <!-- 工具栏 -->
    <div class="toolbar">
      <a-space>
        <a-button 
          type="primary" 
          @click="composeModalVisible = true"
        >
          写邮件
        </a-button>
        
        <a-button 
          @click="batchMarkAsRead"
          :disabled="selectedMails.length === 0"
        >
          标记为已读
        </a-button>
        
        <a-button 
          danger 
          @click="batchDelete"
          :disabled="selectedMails.length === 0"
        >
          删除
        </a-button>
      </a-space>
    </div>
    
    <!-- 邮件列表 -->
    <a-list :data-source="mails" :loading="loading">
      <template #renderItem="{ item }">
        <a-list-item 
          :class="{ unread: !item.read }"
          @click="openMail(item)"
        >
          <a-checkbox 
            v-model:checked="selectedMails" 
            :value="item.id"
            @click.stop
          />
          
          <a-button 
            type="text" 
            @click.stop="toggleStar(item.id)"
          >
            <StarFilled v-if="item.flagged" style="color: #fadb14" />
            <StarOutlined v-else />
          </a-button>
          
          <div class="mail-info">
            <div class="mail-from">{{ item.from }}</div>
            <div class="mail-subject">{{ item.subject }}</div>
            <div class="mail-snippet">{{ item.snippet }}</div>
          </div>
          
          <div class="mail-date">
            {{ formatDate(item.date) }}
          </div>
          
          <a-button 
            danger 
            size="small" 
            @click.stop="deleteMail(item.id)"
          >
            删除
          </a-button>
        </a-list-item>
      </template>
    </a-list>
    
    <!-- 写邮件弹窗 -->
    <ComposeModal 
      v-model:visible="composeModalVisible"
      @sent="handleMailSent"
    />
    
    <!-- 邮件详情弹窗 -->
    <MailDetailModal 
      v-model:visible="detailModalVisible"
      :mail="currentMail"
      @reply="handleReply"
      @delete="deleteMail"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { StarFilled, StarOutlined } from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import ComposeModal from './ComposeModal.vue'
import MailDetailModal from './MailDetailModal.vue'

const mailStore = useMailStore()

const loading = ref(false)
const selectedMails = ref([])
const composeModalVisible = ref(false)
const detailModalVisible = ref(false)
const currentMail = ref(null)

const mails = computed(() => mailStore.currentMails)

onMounted(async () => {
  await fetchMails()
})

async function fetchMails() {
  loading.value = true
  try {
    await mailStore.fetchMailsFromServer()
  } catch (error) {
    message.error('加载邮件失败')
  } finally {
    loading.value = false
  }
}

function openMail(mail) {
  currentMail.value = mail
  detailModalVisible.value = true
  
  // 自动标记为已读
  if (!mail.read) {
    mailStore.markAsReadOnServer(mail.id, true)
  }
}

async function toggleStar(mailId) {
  try {
    await mailStore.toggleFlagOnServer(mailId)
  } catch (error) {
    message.error('星标操作失败')
  }
}

async function deleteMail(mailId) {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这封邮件吗？',
    onOk: async () => {
      try {
        await mailStore.deleteMailFromServer(mailId)
        message.success('邮件已删除')
      } catch (error) {
        message.error('删除失败')
      }
    },
  })
}

async function batchMarkAsRead() {
  try {
    const promises = selectedMails.value.map(mailId =>
      mailStore.markAsReadOnServer(mailId, true)
    )
    await Promise.all(promises)
    message.success(`已标记 ${selectedMails.value.length} 封邮件为已读`)
    selectedMails.value = []
  } catch (error) {
    message.error('批量标记失败')
  }
}

async function batchDelete() {
  Modal.confirm({
    title: '批量删除',
    content: `确定要删除 ${selectedMails.value.length} 封邮件吗？`,
    onOk: async () => {
      try {
        const promises = selectedMails.value.map(mailId =>
          mailStore.deleteMailFromServer(mailId)
        )
        await Promise.all(promises)
        message.success(`已删除 ${selectedMails.value.length} 封邮件`)
        selectedMails.value = []
      } catch (error) {
        message.error('批量删除失败')
      }
    },
  })
}

function handleMailSent() {
  message.success('邮件发送成功')
  fetchMails()
}

function handleReply(replyData) {
  // 处理回复
}

function formatDate(date) {
  const now = new Date()
  const mailDate = new Date(date)
  const diffInHours = (now - mailDate) / (1000 * 60 * 60)
  
  if (diffInHours < 24) {
    return mailDate.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } else if (diffInHours < 24 * 7) {
    return mailDate.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    })
  } else {
    return mailDate.toLocaleDateString('zh-CN')
  }
}
</script>

<style scoped>
.toolbar {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.mail-list .a-list-item {
  cursor: pointer;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.3s;
}

.mail-list .a-list-item:hover {
  background-color: #f5f5f5;
}

.mail-list .a-list-item.unread {
  background-color: #fafafa;
  font-weight: 500;
}

.mail-info {
  flex: 1;
  margin: 0 16px;
}

.mail-from {
  font-weight: 500;
  margin-bottom: 4px;
}

.mail-subject {
  margin-bottom: 4px;
}

.mail-snippet {
  color: #8c8c8c;
  font-size: 12px;
}

.mail-date {
  color: #8c8c8c;
  font-size: 12px;
  margin-right: 16px;
}
</style>
```

---

## 7. 错误处理最佳实践

### 7.1 统一错误处理

```javascript
import { message } from 'ant-design-vue'

async function safeMailOperation(operation, successMsg) {
  try {
    const result = await operation()
    message.success(successMsg)
    return result
  } catch (error) {
    console.error('操作失败:', error)
    
    // 根据错误类型显示不同消息
    if (error.message.includes('401')) {
      message.error('认证已过期，请重新登录')
    } else if (error.message.includes('403')) {
      message.error('权限不足')
    } else if (error.message.includes('网络')) {
      message.error('网络错误，请检查连接')
    } else {
      message.error(`操作失败: ${error.message}`)
    }
    
    throw error
  }
}

// 使用示例
await safeMailOperation(
  () => mailStore.sendMail(mailData),
  '邮件发送成功'
)
```

### 7.2 加载状态管理

```javascript
import { ref } from 'vue'

const loading = ref({
  sending: false,
  deleting: false,
  marking: false,
})

async function sendMail() {
  loading.value.sending = true
  try {
    await mailStore.sendMail(mailData)
  } finally {
    loading.value.sending = false
  }
}
```

---

## 8. 性能优化建议

### 8.1 防抖处理

```javascript
import { debounce } from 'lodash-es'

const debouncedMarkAsRead = debounce(async (mailId) => {
  await mailStore.markAsReadOnServer(mailId, true)
}, 500)

function onMailClick(mail) {
  showMailDetail(mail)
  if (!mail.read) {
    debouncedMarkAsRead(mail.id)
  }
}
```

### 8.2 批量操作优化

```javascript
async function batchOperation(mailIds, operation) {
  const BATCH_SIZE = 5
  const results = []
  
  for (let i = 0; i < mailIds.length; i += BATCH_SIZE) {
    const batch = mailIds.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(id => operation(id))
    )
    results.push(...batchResults)
  }
  
  return results
}
```

---

## 9. 总结

本文档提供了所有 Gmail API 操作的实际使用示例，包括：

- ✅ 发送邮件（单个/多个收件人，HTML 格式）
- ✅ 回复邮件（基础回复、全部回复、带引用）
- ✅ 删除邮件（单个/批量）
- ✅ 标记已读/未读（单个/批量、自动标记）
- ✅ 星标操作（切换、显示星标列表）
- ✅ 完整的邮件列表组件示例
- ✅ 错误处理最佳实践
- ✅ 性能优化建议

所有示例都经过精心设计，可以直接在项目中使用或根据需求调整。
