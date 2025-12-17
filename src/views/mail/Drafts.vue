<template>
  <div class="drafts-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">草稿箱 ({{ drafts.length }})</span>
      </div>

      <div class="toolbar-right">
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
        <a-empty v-if="!loading && drafts.length === 0" description="暂无草稿" />
        
        <div v-else class="mail-list">
          <div
            v-for="draft in drafts"
            :key="draft.id"
            class="draft-item"
            @click="handleEditDraft(draft)"
          >
            <div class="draft-header">
              <span class="draft-subject">{{ draft.subject || '(无主题)' }}</span>
              <span class="draft-time">{{ formatTime(draft.updatedAt) }}</span>
            </div>
            <div class="draft-preview">{{ getPreview(draft.body) }}</div>
            <div class="draft-footer">
              <a-tag size="small" color="orange">草稿</a-tag>
              <div class="draft-actions" @click.stop>
                <a-popconfirm
                  title="确定要删除这个草稿吗？"
                  ok-text="确定"
                  cancel-text="取消"
                  @confirm="handleDeleteDraft(draft)"
                >
                  <a-button type="text" size="small" danger>
                    <template #icon>
                      <DeleteOutlined />
                    </template>
                  </a-button>
                </a-popconfirm>
              </div>
            </div>
          </div>
        </div>
      </a-spin>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'

const mailStore = useMailStore()

const loading = ref(false)

const drafts = computed(() => mailStore.currentMails)

function formatTime(date) {
  if (!date) return ''
  const draftDate = dayjs(date)
  const now = dayjs()
  
  if (draftDate.isSame(now, 'day')) {
    return draftDate.format('HH:mm')
  } else if (draftDate.isSame(now, 'year')) {
    return draftDate.format('MM-DD HH:mm')
  } else {
    return draftDate.format('YYYY-MM-DD')
  }
}

function getPreview(body) {
  if (!body) return '(无内容)'
  const text = body.replace(/<[^>]*>/g, '')
  return text.length > 100 ? text.substring(0, 100) + '...' : text
}

/**
 * 加载草稿
 * 注意：现在邮件已经在 Main.vue 中统一加载，这里只需要切换文件夹
 */
function loadDrafts() {
  // 邮件已在 Main.vue 中加载，这里只切换文件夹即可
  mailStore.switchFolder('drafts')
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

function handleEditDraft(draft) {
  // TODO: 打开撰写窗口并加载草稿内容
  message.info('编辑草稿功能开发中...')
}

async function handleDeleteDraft(draft) {
  try {
    await mailStore.permanentlyDeleteMail(draft.id)
    message.success('草稿已删除')
  } catch (error) {
    message.error('删除失败：' + error.message)
  }
}

onMounted(() => {
  // 切换到 drafts 文件夹
  loadDrafts()
})
</script>

<style lang="scss" scoped>
.drafts-page {
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

.mail-list-container {
  flex: 1;
  overflow-y: auto;
}

.mail-list {
  padding: 8px;
}

.draft-item {
  padding: 16px;
  border-bottom: 1px solid #F5F5F5;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: #FAFAFA;
  }
}

.draft-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.draft-subject {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.draft-time {
  font-size: 12px;
  color: #8C8C8C;
}

.draft-preview {
  font-size: 13px;
  color: #8C8C8C;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.draft-actions {
  display: flex;
  gap: 4px;
}
</style>
