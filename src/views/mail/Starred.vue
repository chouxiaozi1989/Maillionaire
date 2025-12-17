<template>
  <div class="starred-view">
    <div class="view-header">
      <h2>
        <StarFilled style="color: #fadb14; margin-right: 8px" />
        星标邮件
      </h2>
      <div class="header-actions">
        <a-button @click="handleRefresh" :loading="loading">
          <template #icon>
            <ReloadOutlined />
          </template>
          刷新
        </a-button>
      </div>
    </div>

    <div class="mail-list">
      <a-spin :spinning="loading" tip="加载中...">
        <a-empty v-if="!loading && mails.length === 0" description="暂无星标邮件" />
        
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
                      <StarFilled style="color: #fadb14; margin-right: 4px" />
                      {{ item.subject || '(无主题)' }}
                    </div>
                    <div class="mail-snippet">{{ item.snippet }}</div>
                  </div>
                </template>
              </a-list-item-meta>
              
              <template #actions>
                <a-button 
                  type="text" 
                  danger
                  @click.stop="handleRemoveStar(item)"
                >
                  <StarFilled />
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
import { message } from 'ant-design-vue'
import { StarFilled, ReloadOutlined } from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import MailDetailModal from '@/components/mail/MailDetailModal.vue'

const mailStore = useMailStore()

const loading = ref(false)
const selectedMail = ref(null)
const showDetailModal = ref(false)

// 计算属性：使用 currentMails (已按文件夹筛选)
const mails = computed(() => mailStore.currentMails)

/**
 * 加载邮件
 * 注意：现在邮件已经在 Main.vue 中统一加载，这里只需要切换文件夹
 */
function loadMails() {
  // 邮件已在 Main.vue 中加载，这里只切换文件夹即可
  mailStore.switchFolder('starred')
}

/**
 * 刷新
 */
async function handleRefresh() {
  try {
    loading.value = true
    await mailStore.loadMails()
    message.success('刷新成功')
  } catch (error) {
    message.error('刷新失败：' + error.message)
  } finally {
    loading.value = false
  }
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
 * 移除星标
 */
async function handleRemoveStar(mail) {
  try {
    await mailStore.toggleFlagOnServer(mail.id)
    message.success('已移除星标')
  } catch (error) {
    message.error('操作失败：' + error.message)
  }
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
  loadMails()
})
</script>

<style lang="scss" scoped>
.starred-view {
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
  display: flex;
  align-items: center;
}

.mail-snippet {
  font-size: 13px;
  color: #8C8C8C;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
