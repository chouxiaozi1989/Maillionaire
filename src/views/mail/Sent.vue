<template>
  <div class="sent-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <!-- 多选模式切换 -->
        <a-button
          :type="isSelectMode ? 'primary' : 'default'"
          @click="toggleSelectMode"
        >
          <template #icon>
            <CheckSquareOutlined v-if="isSelectMode" />
            <BorderOutlined v-else />
          </template>
          {{ isSelectMode ? '取消多选' : '多选' }}
        </a-button>

        <!-- 批量操作按钮 -->
        <template v-if="isSelectMode && selectedCount > 0">
          <a-divider type="vertical" />

          <a-space>
            <a-button @click="handleSelectAll">
              全选 ({{ selectedCount }}/{{ sentMails.length }})
            </a-button>

            <a-button @click="handleBatchMarkAsRead">
              <template #icon>
                <CheckOutlined />
              </template>
              标为已读
            </a-button>

            <a-popconfirm
              title="确定要删除选中的邮件吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="handleBatchDelete"
            >
              <a-button danger>
                <template #icon>
                  <DeleteOutlined />
                </template>
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>

        <a-divider type="vertical" />

        <a-select v-model:value="dateRange" class="filter-select" @change="handleFilterChange">
          <a-select-option value="today">今天</a-select-option>
          <a-select-option value="week">最近7天</a-select-option>
          <a-select-option value="month">最近30天</a-select-option>
          <a-select-option value="all">全部</a-select-option>
        </a-select>
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
        <a-empty v-if="!loading && sentMails.length === 0" description="暂无已发送邮件" />
        
        <div v-else class="mail-list">
          <MailItem
            v-for="mail in sentMails"
            :key="mail.id"
            :mail="mail"
            :selected="selectedMailIds.includes(mail.id)"
            :selectable="isSelectMode"
            @click="handleMailClick(mail)"
            @select="handleMailSelect"
            @delete="handleDeleteMail(mail)"
          />
        </div>
      </a-spin>
    </div>

    <!-- 邮件详情弹窗 -->
    <MailDetailModal
      v-model:visible="showDetailModal"
      :mail="selectedMail"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import MailItem from '@/components/mail/MailItem.vue'
import MailDetailModal from '@/components/mail/MailDetailModal.vue'

const mailStore = useMailStore()

const loading = ref(false)
const dateRange = ref('all')
const showDetailModal = ref(false)
const selectedMail = ref(null)
const isSelectMode = ref(false)

const sentMails = computed(() => mailStore.currentMails)
const selectedMailIds = computed(() => mailStore.selectedMailIds)
const selectedCount = computed(() => selectedMailIds.value.length)

function toggleSelectMode() {
  isSelectMode.value = !isSelectMode.value
  if (!isSelectMode.value) {
    mailStore.clearSelection()
  }
}

function handleMailSelect(mail, checked) {
  if (checked) {
    mailStore.selectMail(mail.id)
  } else {
    mailStore.unselectMail(mail.id)
  }
}

function handleSelectAll() {
  if (selectedCount.value === sentMails.value.length) {
    mailStore.clearSelection()
  } else {
    mailStore.selectAll()
  }
}

async function handleBatchMarkAsRead() {
  if (selectedCount.value === 0) {
    message.warning('请先选择邮件')
    return
  }

  try {
    loading.value = true
    await mailStore.batchMarkAsRead(selectedMailIds.value)
    message.success(`已将 ${selectedCount.value} 封邮件标记为已读`)
    mailStore.clearSelection()
  } catch (error) {
    message.error('批量标记失败：' + error.message)
  } finally {
    loading.value = false
  }
}

async function handleBatchDelete() {
  if (selectedCount.value === 0) {
    message.warning('请先选择邮件')
    return
  }

  try {
    loading.value = true
    await mailStore.batchDelete(selectedMailIds.value)
    message.success(`已将 ${selectedCount.value} 封邮件移至回收站`)
    mailStore.clearSelection()
  } catch (error) {
    message.error('批量删除失败：' + error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 加载邮件
 * 注意：现在邮件已经在 Main.vue 中统一加载，这里只需要切换文件夹
 */
function loadMails() {
  // 邮件已在 Main.vue 中加载，这里只切换文件夹即可
  mailStore.switchFolder('sent')
}

function handleFilterChange() {
  mailStore.updateFilter({ dateRange: dateRange.value })
}

async function handleRefresh() {
  // 刷新时重新加载所有邮件
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
  if (isSelectMode.value) {
    return
  }
  
  selectedMail.value = mail
  showDetailModal.value = true
  mailStore.markAsRead(mail.id)
}

async function handleDeleteMail(mail) {
  try {
    await mailStore.deleteMail(mail.id)
    message.success('已移至回收站')
  } catch (error) {
    message.error('删除失败：' + error.message)
  }
}

async function handleDelete(mail) {
  await handleDeleteMail(mail)
  showDetailModal.value = false
}

onMounted(() => {
  // 切换到 sent 文件夹
  loadMails()
})
</script>

<style lang="scss" scoped>
.sent-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.toolbar {
  min-height: 56px;
  padding: 12px 16px;
  border-bottom: 1px solid #F0F0F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-select {
  min-width: 120px;
}

.mail-list-container {
  flex: 1;
  overflow-y: auto;
}

.mail-list {
  padding: 8px;
}
</style>
