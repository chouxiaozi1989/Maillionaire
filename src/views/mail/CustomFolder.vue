<template>
  <div class="custom-folder-view">
    <div class="view-header">
      <h2>
        <FolderOutlined style="margin-right: 8px" />
        {{ folderName }}
      </h2>
      <div class="header-actions">
        <a-button @click="handleRefresh" :loading="loading">
          <template #icon>
            <ReloadOutlined />
          </template>
          刷新
        </a-button>
        <a-button danger @click="handleDeleteFolder">
          <template #icon>
            <DeleteOutlined />
          </template>
          删除文件夹
        </a-button>
      </div>
    </div>

    <div class="mail-list">
      <a-spin :spinning="loading" tip="加载中...">
        <a-empty 
          v-if="!loading && mails.length === 0" 
          description="该文件夹暂无邮件" 
        />
        
        <a-list v-else :data-source="mails" item-layout="horizontal">
          <template #renderItem="{ item }">
            <a-list-item 
              class="mail-item" 
              :class="{ unread: !item.read }"
              @click="handleMailClick(item)"
            >
              <a-list-item-meta>
                <template #avatar>
                  <a-avatar 
                    :style="{ backgroundColor: getAvatarColor(item.from) }"
                  >
                    {{ getInitial(item.from) }}
                  </a-avatar>
                </template>
                
                <template #title>
                  <div class="mail-header">
                    <span class="mail-from">{{ item.from }}</span>
                    <span class="mail-date">{{ formatDate(item.date) }}</span>
                  </div>
                </template>
                
                <template #description>
                  <div class="mail-content">
                    <div class="mail-subject">
                      {{ item.subject || '(无主题)' }}
                    </div>
                    <div class="mail-snippet">{{ item.snippet }}</div>
                  </div>
                </template>
              </a-list-item-meta>
              
              <template #actions>
                <a-button 
                  type="text" 
                  @click.stop="handleToggleStar(item)"
                >
                  <StarFilled v-if="item.flagged" style="color: #fadb14" />
                  <StarOutlined v-else />
                </a-button>
                <a-button 
                  type="text" 
                  danger
                  @click.stop="handleDelete(item)"
                >
                  <DeleteOutlined />
                </a-button>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>
    </div>

    <!-- 邮件详情弹窗 -->
    <MailDetailModal 
      v-if="selectedMail"
      v-model:visible="showDetailModal"
      :mail="selectedMail"
      @refresh="loadMails"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { 
  FolderOutlined, 
  ReloadOutlined, 
  DeleteOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import MailDetailModal from '@/components/mail/MailDetailModal.vue'

const route = useRoute()
const router = useRouter()
const mailStore = useMailStore()

const loading = ref(false)
const selectedMail = ref(null)
const showDetailModal = ref(false)

// 获取文件夹 ID
const folderId = computed(() => route.params.folderId)

// 获取文件夹信息
const folder = computed(() => {
  return mailStore.folders.find(f => f.id === folderId.value)
})

// 文件夹名称
const folderName = computed(() => {
  return folder.value?.name || '未知文件夹'
})

// 计算属性：当前文件夹的邮件
const mails = computed(() => {
  return mailStore.mails.filter(mail => mail.folder === folderId.value)
})

/**
 * 加载邮件
 */
async function loadMails() {
  if (!folderId.value) {
    message.error('文件夹 ID 无效')
    return
  }
  
  loading.value = true
  try {
    await mailStore.loadMails(folderId.value)
  } catch (error) {
    console.error('Load mails failed:', error)
    message.error('加载失败：' + error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 刷新
 */
async function handleRefresh() {
  await loadMails()
  message.success('刷新成功')
}

/**
 * 点击邮件
 */
function handleMailClick(mail) {
  selectedMail.value = mail
  showDetailModal.value = true
  
  // 标记为已读
  if (!mail.read) {
    mailStore.markAsReadOnServer(mail.id, true)
  }
}

/**
 * 切换星标
 */
async function handleToggleStar(mail) {
  try {
    await mailStore.toggleFlagOnServer(mail.id)
    const action = mail.flagged ? '移除' : '添加'
    message.success(`已${action}星标`)
  } catch (error) {
    message.error('操作失败：' + error.message)
  }
}

/**
 * 删除邮件
 */
async function handleDelete(mail) {
  Modal.confirm({
    title: '确认删除',
    content: '确定要删除这封邮件吗？',
    onOk: async () => {
      try {
        await mailStore.deleteMailFromServer(mail.id)
        message.success('邮件已删除')
      } catch (error) {
        message.error('删除失败：' + error.message)
      }
    },
  })
}

/**
 * 删除文件夹
 */
async function handleDeleteFolder() {
  if (!folder.value) {
    message.error('文件夹不存在')
    return
  }
  
  if (folder.value.system) {
    message.error('系统文件夹不能删除')
    return
  }
  
  Modal.confirm({
    title: '确认删除文件夹',
    content: `确定要删除文件夹"${folderName.value}"吗？文件夹中的邮件不会被删除。`,
    onOk: async () => {
      try {
        await mailStore.deleteFolder(folderId.value)
        message.success('文件夹已删除')
        router.push('/main/inbox')
      } catch (error) {
        message.error('删除失败：' + error.message)
      }
    },
  })
}

/**
 * 获取头像颜色
 */
function getAvatarColor(email) {
  const colors = ['#1890FF', '#FA8C16', '#52C41A', '#13C2C2', '#722ED1']
  const index = email?.charCodeAt(0) % colors.length || 0
  return colors[index]
}

/**
 * 获取首字母
 */
function getInitial(email) {
  return email?.charAt(0).toUpperCase() || '?'
}

/**
 * 格式化日期
 */
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

// 初始化
onMounted(() => {
  if (!folderId.value) {
    message.error('文件夹 ID 缺失')
    router.push('/main/inbox')
    return
  }
  
  // 检查文件夹是否存在
  if (!folder.value) {
    message.error(`文件夹"${folderId.value}"不存在`)
    router.push('/main/inbox')
    return
  }
  
  loadMails()
})
</script>

<style lang="scss" scoped>
.custom-folder-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.view-header {
  padding: 20px 24px;
  border-bottom: 1px solid #F0F0F0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
}

.mail-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.mail-item {
  cursor: pointer;
  padding: 16px 24px;
  border-bottom: 1px solid #F0F0F0;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: #F5F5F5;
  }
  
  &.unread {
    background-color: #F0F7FF;
    
    .mail-from {
      font-weight: 600;
    }
  }
}

.mail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.mail-from {
  font-size: 14px;
  color: #262626;
}

.mail-date {
  font-size: 12px;
  color: #8C8C8C;
}

.mail-content {
  margin-top: 4px;
}

.mail-subject {
  font-size: 14px;
  color: #262626;
  margin-bottom: 4px;
  font-weight: 500;
}

.mail-snippet {
  font-size: 13px;
  color: #8C8C8C;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
