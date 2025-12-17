<template>
  <a-modal
    v-model:open="visible"
    title="邮件详情"
    :width="900"
    :footer="null"
    @cancel="handleClose"
  >
    <div v-if="mail" class="mail-detail">
      <!-- 操作栏 -->
      <div class="action-bar">
        <a-space>
          <a-button @click="$emit('reply', mail)">
            <template #icon>
              <RollbackOutlined />
            </template>
            回复
          </a-button>
          <a-button @click="$emit('forward', mail)">
            <template #icon>
              <ShareAltOutlined />
            </template>
            转发
          </a-button>
          <a-button danger @click="handleDelete">
            <template #icon>
              <DeleteOutlined />
            </template>
            删除
          </a-button>
        </a-space>
      </div>

      <!-- 邮件头部信息 -->
      <div class="mail-meta">
        <h2 class="mail-subject">{{ mail.subject || '(无主题)' }}</h2>

        <div class="meta-row">
          <span class="meta-label">发件人:</span>
          <span class="meta-value">{{ mail.from }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">收件人:</span>
          <span class="meta-value">{{ mail.to }}</span>
        </div>

        <div v-if="mail.cc" class="meta-row">
          <span class="meta-label">抄送:</span>
          <span class="meta-value">{{ mail.cc }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">时间:</span>
          <span class="meta-value">{{ formatDateTime(mail.date) }}</span>
        </div>
      </div>

      <!-- 邮件正文 -->
      <div class="mail-body" v-html="sanitizeHtml(mail.body)"></div>

      <!-- 附件列表 -->
      <div v-if="mail.attachments && mail.attachments.length > 0" class="attachments">
        <h3 class="attachment-title">附件 ({{ mail.attachments.length }})</h3>
        <div class="attachment-list">
          <div
            v-for="(attachment, index) in mail.attachments"
            :key="index"
            class="attachment-card"
            @click="handleDownloadAttachment(attachment)"
          >
            <div class="attachment-icon">
              <FileOutlined />
            </div>
            <div class="attachment-info">
              <div class="attachment-name">{{ attachment.name }}</div>
              <div class="attachment-size">{{ formatFileSize(attachment.size) }}</div>
            </div>
            <DownloadOutlined class="download-icon" />
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import DOMPurify from 'dompurify'
import {
  RollbackOutlined,  // 回复图标（替代 ReplyOutlined）
  ShareAltOutlined,
  DeleteOutlined,
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  mail: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible', 'reply', 'forward', 'delete'])

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

/**
 * 格式化日期时间
 */
function formatDateTime(date) {
  if (!date) return ''
  return dayjs(date).format('YYYY年MM月DD日 HH:mm:ss')
}

/**
 * 清理HTML内容（防XSS）
 */
function sanitizeHtml(html) {
  if (!html) return '<p style="color: #8C8C8C;">(无内容)</p>'
  return DOMPurify.sanitize(html)
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
}

/**
 * 下载附件
 */
function handleDownloadAttachment(attachment) {
  // TODO: 实现附件下载
  message.info(`下载附件: ${attachment.name}`)
  console.log('Download:', attachment)
}

/**
 * 删除邮件
 */
function handleDelete() {
  emit('delete', props.mail)
}

/**
 * 关闭弹窗
 */
function handleClose() {
  visible.value = false
}
</script>

<style lang="scss" scoped>
.mail-detail {
  max-height: 70vh;
  overflow-y: auto;
}

.action-bar {
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #F0F0F0;
}

.mail-meta {
  margin-bottom: 24px;
}

.mail-subject {
  font-size: 24px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 16px;
}

.meta-row {
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
}

.meta-label {
  color: #8C8C8C;
  min-width: 80px;
}

.meta-value {
  color: #262626;
  flex: 1;
}

.mail-body {
  padding: 16px;
  border: 1px solid #F0F0F0;
  border-radius: 8px;
  background: #FAFAFA;
  font-size: 14px;
  line-height: 1.8;
  color: #262626;
  margin-bottom: 24px;

  :deep(img) {
    max-width: 100%;
    height: auto;
  }

  :deep(a) {
    color: #1890FF;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.attachments {
  padding-top: 24px;
  border-top: 1px solid #F0F0F0;
}

.attachment-title {
  font-size: 16px;
  font-weight: 500;
  color: #595959;
  margin-bottom: 12px;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attachment-card {
  padding: 12px 16px;
  border: 1px solid #D9D9D9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: #1890FF;
    background: #F0F7FF;

    .download-icon {
      color: #1890FF;
    }
  }
}

.attachment-icon {
  width: 40px;
  height: 40px;
  background: #F5F5F5;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #1890FF;
}

.attachment-info {
  flex: 1;
  min-width: 0;
}

.attachment-name {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  font-size: 12px;
  color: #8C8C8C;
}

.download-icon {
  font-size: 18px;
  color: #8C8C8C;
  transition: color 0.3s;
}
</style>
