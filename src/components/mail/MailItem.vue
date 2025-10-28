<template>
  <div
    class="mail-item"
    :class="{ unread: !mail.read, selected: isSelected }"
    @click="handleClick"
  >
    <!-- 多选框 -->
    <a-checkbox
      v-if="selectable"
      :checked="isSelected"
      @click.stop
      @change="handleSelectChange"
      class="mail-checkbox"
    />

    <!-- 未读标记 -->
    <div v-if="!mail.read" class="unread-dot"></div>

    <!-- 邮件内容 -->
    <div class="mail-content">
      <div class="mail-header">
        <span class="mail-sender">{{ mail.from || '未知发件人' }}</span>
        <span class="mail-time">{{ formatTime(mail.date) }}</span>
      </div>

      <div class="mail-subject">{{ mail.subject || '(无主题)' }}</div>

      <div class="mail-preview">{{ getPreview(mail.body) }}</div>

      <div class="mail-footer">
        <a-tag v-if="mail.hasAttachment" color="orange" size="small">
          <template #icon>
            <PaperClipOutlined />
          </template>
          附件
        </a-tag>
        <a-tag v-if="mail.flagged" color="gold" size="small">
          <template #icon>
            <StarFilled />
          </template>
          星标
        </a-tag>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="mail-actions" @click.stop>
      <a-button
        type="text"
        size="small"
        :class="{ starred: mail.flagged }"
        @click="$emit('star', mail)"
      >
        <template #icon>
          <StarFilled v-if="mail.flagged" style="color: #FADB14" />
          <StarOutlined v-else />
        </template>
      </a-button>

      <a-popconfirm
        title="确定要删除这封邮件吗？"
        ok-text="确定"
        cancel-text="取消"
        @confirm="$emit('delete', mail)"
      >
        <a-button type="text" size="small" danger>
          <template #icon>
            <DeleteOutlined />
          </template>
        </a-button>
      </a-popconfirm>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import {
  PaperClipOutlined,
  StarOutlined,
  StarFilled,
  DeleteOutlined,
} from '@ant-design/icons-vue'

const props = defineProps({
  mail: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  selectable: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click', 'star', 'delete', 'select'])

const isSelected = computed(() => props.selected)

/**
 * 格式化时间
 */
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

/**
 * 获取邮件预览
 */
function getPreview(body) {
  if (!body) return '(无内容)'
  
  // 去除HTML标签
  const text = body.replace(/<[^>]*>/g, '')
  // 截取前100个字符
  return text.length > 100 ? text.substring(0, 100) + '...' : text
}

/**
 * 点击邮件
 */
function handleClick() {
  if (props.selectable) {
    // 多选模式下，点击切换选中状态
    handleSelectChange(!isSelected.value)
  } else {
    // 正常模式下，打开详情
    emit('click', props.mail)
  }
}

/**
 * 选中状态改变
 */
function handleSelectChange(checked) {
  emit('select', props.mail, checked)
}
</script>

<style lang="scss" scoped>
.mail-item {
  position: relative;
  padding: 16px;
  padding-left: 24px;
  border-bottom: 1px solid #F5F5F5;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  gap: 16px;

  &:hover {
    background: #FAFAFA;

    .mail-actions {
      opacity: 1;
    }
  }

  &.unread {
    background: #F0F7FF;
  }

  &.selected {
    background: #E6F7FF;
  }
}

.mail-checkbox {
  margin-top: 4px;
  flex-shrink: 0;
}

.unread-dot {
  position: absolute;
  left: 8px;
  top: 20px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #FF4D4F;
}

.mail-content {
  flex: 1;
  min-width: 0;
}

.mail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.mail-sender {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mail-time {
  font-size: 12px;
  color: #8C8C8C;
  flex-shrink: 0;
  margin-left: 12px;
}

.mail-subject {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mail-preview {
  font-size: 13px;
  color: #8C8C8C;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8px;
}

.mail-footer {
  display: flex;
  gap: 8px;
}

.mail-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
</style>
