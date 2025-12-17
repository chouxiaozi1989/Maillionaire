<template>
  <div class="trash-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">回收站 ({{ trashedMails.length }})</span>
      </div>

      <div class="toolbar-right">
        <a-popconfirm
          v-if="trashedMails.length > 0"
          title="确定要清空回收站吗？此操作不可恢复！"
          ok-text="确定"
          cancel-text="取消"
          @confirm="handleEmptyTrash"
        >
          <a-button danger>
            <template #icon>
              <DeleteOutlined />
            </template>
            清空回收站
          </a-button>
        </a-popconfirm>
        
        <a-button @click="handleRefresh" :loading="loading">
          <template #icon>
            <ReloadOutlined />
          </template>
          刷新
        </a-button>
      </div>
    </div>

    <!-- 邮件列表 -->
    <div class="mail-list-container">
      <a-spin :spinning="loading">
        <a-empty v-if="!loading && trashedMails.length === 0" description="回收站是空的" />
        
        <div v-else class="mail-list">
          <div
            v-for="mail in trashedMails"
            :key="mail.id"
            class="trash-item"
          >
            <div class="trash-content" @click="handleMailClick(mail)">
              <div class="trash-header">
                <span class="trash-sender">{{ mail.from || '未知发件人' }}</span>
                <span class="trash-time">{{ formatTime(mail.date) }}</span>
              </div>
              <div class="trash-subject">{{ mail.subject || '(无主题)' }}</div>
              <div class="trash-preview">{{ getPreview(mail.body) }}</div>
            </div>
            
            <div class="trash-actions">
              <a-button type="primary" size="small" @click="handleRestore(mail)">
                <template #icon>
                  <RollbackOutlined />
                </template>
                还原
              </a-button>
              
              <a-popconfirm
                title="确定要永久删除这封邮件吗？"
                ok-text="确定"
                cancel-text="取消"
                @confirm="handlePermanentDelete(mail)"
              >
                <a-button type="primary" danger size="small">
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                  永久删除
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
      </a-spin>
    </div>

    <!-- 邮件详情弹窗 -->
    <MailDetailModal
      v-model:visible="showDetailModal"
      :mail="selectedMail"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  ReloadOutlined,
  DeleteOutlined,
  RollbackOutlined,
} from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import MailDetailModal from '@/components/mail/MailDetailModal.vue'

const mailStore = useMailStore()

const loading = ref(false)
const showDetailModal = ref(false)
const selectedMail = ref(null)

const trashedMails = computed(() => mailStore.currentMails)

function formatTime(date) {
  if (!date) return ''
  const mailDate = dayjs(date)
  const now = dayjs()
  
  if (mailDate.isSame(now, 'day')) {
    return mailDate.format('HH:mm')
  } else if (mailDate.isSame(now, 'year')) {
    return mailDate.format('MM-DD')
  } else {
    return mailDate.format('YYYY-MM-DD')
  }
}

function getPreview(body) {
  if (!body) return '(无内容)'
  const text = body.replace(/<[^>]*>/g, '')
  return text.length > 100 ? text.substring(0, 100) + '...' : text
}

/**
 * 加载回收站
 * 注意：现在邮件已经在 Main.vue 中统一加载，这里只需要切换文件夹
 */
function loadTrash() {
  // 邮件已在 Main.vue 中加载，这里只切换文件夹即可
  mailStore.switchFolder('trash')
}

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

function handleMailClick(mail) {
  selectedMail.value = mail
  showDetailModal.value = true
}

async function handleRestore(mail) {
  try {
    // 还原到收件箱
    await mailStore.updateMail(mail.id, { folder: 'inbox' })
    message.success('已还原到收件箱')
  } catch (error) {
    message.error('还原失败：' + error.message)
  }
}

async function handlePermanentDelete(mail) {
  try {
    await mailStore.permanentlyDeleteMail(mail.id)
    message.success('已永久删除')
  } catch (error) {
    message.error('删除失败：' + error.message)
  }
}

async function handleEmptyTrash() {
  try {
    loading.value = true
    // 永久删除所有回收站邮件
    for (const mail of trashedMails.value) {
      await mailStore.permanentlyDeleteMail(mail.id)
    }
    message.success('回收站已清空')
  } catch (error) {
    message.error('清空失败：' + error.message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 切换到 trash 文件夹
  loadTrash()
})
</script>

<style lang="scss" scoped>
.trash-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.toolbar {
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid #F0F0F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-title {
  font-size: 16px;
  font-weight: 500;
  color: #262626;
}

.toolbar-right {
  display: flex;
  gap: 12px;
}

.mail-list-container {
  flex: 1;
  overflow-y: auto;
}

.mail-list {
  padding: 8px;
}

.trash-item {
  padding: 16px;
  border: 1px solid #F0F0F0;
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  transition: all 0.3s;
  
  &:hover {
    border-color: #FF4D4F;
    box-shadow: 0 2px 8px rgba(255, 77, 79, 0.15);
  }
}

.trash-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.trash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.trash-sender {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.trash-time {
  font-size: 12px;
  color: #8C8C8C;
}

.trash-subject {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trash-preview {
  font-size: 13px;
  color: #8C8C8C;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trash-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
</style>
