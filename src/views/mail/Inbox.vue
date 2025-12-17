<template>
  <div class="inbox-page">
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

        <!-- 批量操作按钮（仅在多选模式且有选中项时显示） -->
        <template v-if="isSelectMode && selectedCount > 0">
          <a-divider type="vertical" />

          <a-space>
            <a-button @click="handleSelectAll">
              全选 ({{ selectedCount }}/{{ mails.length }})
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

            <a-button type="primary" @click="handleExportMails" :loading="exporting">
              <template #icon>
                <ExportOutlined />
              </template>
              导出
            </a-button>
          </a-space>
        </template>

        <a-divider type="vertical" />

        <a-select v-model:value="filterType" class="filter-select" @change="handleFilterChange">
          <a-select-option value="all">全部邮件</a-select-option>
          <a-select-option value="unread">未读</a-select-option>
          <a-select-option value="read">已读</a-select-option>
          <a-select-option value="flagged">星标</a-select-option>
          <a-select-option value="attachment">有附件</a-select-option>
        </a-select>

        <a-divider type="vertical" />

        <a-select v-model:value="dateRange" class="filter-select" @change="handleFilterChange">
          <a-select-option value="today">今天</a-select-option>
          <a-select-option value="week">最近7天</a-select-option>
          <a-select-option value="month">最近30天</a-select-option>
          <a-select-option value="all">全部</a-select-option>
        </a-select>

        <a-divider type="vertical" />

        <a-select v-model:value="limit" class="filter-select" @change="handleFilterChange">
          <a-select-option :value="10">最新10封</a-select-option>
          <a-select-option :value="50">最新50封</a-select-option>
          <a-select-option :value="100">最新100封</a-select-option>
          <a-select-option :value="null">全部</a-select-option>
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
        <a-empty v-if="!loading && mails.length === 0" description="暂无邮件" />
        
        <div v-else class="mail-list">
          <MailItem
            v-for="mail in mails"
            :key="mail.id"
            :mail="mail"
            :selected="selectedMailIds.includes(mail.id)"
            :selectable="isSelectMode"
            @click="handleMailClick(mail)"
            @select="handleMailSelect"
            @star="handleToggleStar(mail)"
            @delete="handleDeleteMail(mail)"
          />
        </div>
      </a-spin>

      <!-- 分页 -->
      <div v-if="mails.length > 0" class="pagination">
        <a-pagination
          v-model:current="currentPage"
          v-model:page-size="pageSize"
          :total="totalMails"
          show-size-changer
          show-quick-jumper
          :show-total="(total) => `共 ${total} 封邮件`"
        />
      </div>
    </div>

    <!-- 邮件详情弹窗 -->
    <MailDetailModal
      v-model:visible="showDetailModal"
      :mail="selectedMail"
      @reply="handleReply"
      @forward="handleForward"
      @delete="handleDelete"
    />

    <!-- 导出进度弹窗 -->
    <a-modal
      v-model:open="showExportProgress"
      title="导出邮件"
      :closable="false"
      :maskClosable="false"
      :footer="null"
      width="500px"
    >
      <div class="export-progress-container">
        <a-progress
          :percent="exportProgress.percent"
          :status="exportProgress.percent === 100 ? 'success' : 'active'"
        />
        <p class="progress-message">{{ exportProgress.message }}</p>
        <p v-if="exportProgress.current && exportProgress.total" class="progress-detail">
          {{ exportProgress.current }} / {{ exportProgress.total }}
        </p>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  CheckOutlined,
  DeleteOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import MailItem from '@/components/mail/MailItem.vue'
import MailDetailModal from '@/components/mail/MailDetailModal.vue'

const mailStore = useMailStore()

// 状态
const loading = ref(false)
const exporting = ref(false)
const showExportProgress = ref(false)
const exportProgress = ref({
  percent: 0,
  message: '准备导出...',
  step: '',
  current: 0,
  total: 0,
})
const filterType = ref('all')
const dateRange = ref('all')
const limit = ref(50)
const currentPage = ref(1)
const pageSize = ref(20)
const showDetailModal = ref(false)
const selectedMail = ref(null)
const isSelectMode = ref(false)  // 多选模式

// 计算属性
const mails = computed(() => mailStore.currentMails)
const totalMails = computed(() => mails.value.length)
const selectedMailIds = computed(() => mailStore.selectedMailIds)
const selectedCount = computed(() => selectedMailIds.value.length)

/**
 * 切换多选模式
 */
function toggleSelectMode() {
  isSelectMode.value = !isSelectMode.value
  if (!isSelectMode.value) {
    // 退出多选模式时清空选中项
    mailStore.clearSelection()
  }
}

/**
 * 处理邮件选中
 */
function handleMailSelect(mail, checked) {
  if (checked) {
    mailStore.selectMail(mail.id)
  } else {
    mailStore.unselectMail(mail.id)
  }
}

/**
 * 全选/反选
 */
function handleSelectAll() {
  if (selectedCount.value === mails.value.length) {
    // 已全选，清空选中
    mailStore.clearSelection()
  } else {
    // 未全选，全选
    mailStore.selectAll()
  }
}

/**
 * 批量标记为已读
 */
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

/**
 * 批量删除
 */
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
 * 导出邮件
 */
async function handleExportMails() {
  if (selectedCount.value === 0) {
    message.warning('请先选择要导出的邮件')
    return
  }

  // 设置进度监听器
  let progressCleanup = null

  try {
    exporting.value = true
    showExportProgress.value = true

    // 重置进度
    exportProgress.value = {
      percent: 0,
      message: '准备导出...',
      step: '',
      current: 0,
      total: 0,
    }

    // 注册进度监听器
    if (window.electronAPI?.onExportProgress) {
      progressCleanup = window.electronAPI.onExportProgress((progress) => {
        exportProgress.value = {
          percent: progress.percent || 0,
          message: progress.message || '导出中...',
          step: progress.step || '',
          current: progress.current || 0,
          total: progress.total || 0,
        }
      })
    }

    const result = await mailStore.exportMails()

    if (result.canceled) {
      showExportProgress.value = false
      message.info('已取消导出')
      return
    }

    if (result.success) {
      // 等待一小段时间让用户看到100%进度
      await new Promise(resolve => setTimeout(resolve, 500))

      showExportProgress.value = false

      const hasAttachments = result.zipPath ? '（含附件）' : ''
      message.success({
        content: `成功导出 ${result.mailCount} 封邮件${hasAttachments}`,
        duration: 3,
      })

      // 清空选中
      mailStore.clearSelection()

      // 可选：退出多选模式
      isSelectMode.value = false
    } else {
      throw new Error(result.error || '导出失败')
    }
  } catch (error) {
    console.error('Export error:', error)
    showExportProgress.value = false
    message.error('导出失败：' + error.message)
  } finally {
    exporting.value = false
    // 清理进度监听器
    if (progressCleanup) {
      progressCleanup()
    }
  }
}

/**
 * 加载邮件
 * 注意：现在邮件已经在 Main.vue 中统一加载，这里只需要切换文件夹
 */
function loadMails() {
  // 邮件已在 Main.vue 中加载，这里只切换文件夹即可
  mailStore.switchFolder('inbox')
}

/**
 * 筛选条件改变
 */
function handleFilterChange() {
  mailStore.updateFilter({
    type: filterType.value,
    dateRange: dateRange.value,
    limit: limit.value,
  })
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
 * 邮件点击
 */
function handleMailClick(mail) {
  // 多选模式下不打开详情
  if (isSelectMode.value) {
    return
  }

  selectedMail.value = mail
  showDetailModal.value = true
  
  // 标记为已读
  if (!mail.read) {
    mailStore.markAsRead(mail.id)
  }
}

/**
 * 切换星标
 */
async function handleToggleStar(mail) {
  try {
    await mailStore.toggleFlag(mail.id)
    message.success(mail.flagged ? '已取消星标' : '已加星标')
  } catch (error) {
    message.error('操作失败：' + error.message)
  }
}

/**
 * 删除邮件
 */
async function handleDeleteMail(mail) {
  try {
    await mailStore.deleteMail(mail.id)
    message.success('已移至回收站')
  } catch (error) {
    message.error('删除失败：' + error.message)
  }
}

/**
 * 回复邮件
 */
function handleReply(mail) {
  console.log('Reply:', mail)
  // TODO: 打开撰写窗口并填充回复内容
  message.info('回复功能开发中...')
}

/**
 * 转发邮件
 */
function handleForward(mail) {
  console.log('Forward:', mail)
  // TODO: 打开撰写窗口并填充转发内容
  message.info('转发功能开发中...')
}

/**
 * 从详情弹窗删除
 */
async function handleDelete(mail) {
  await handleDeleteMail(mail)
  showDetailModal.value = false
}

// 监听筛选条件变化
watch([filterType, dateRange, limit], () => {
  handleFilterChange()
})

// 初始化
onMounted(() => {
  loadMails()
})
</script>

<style lang="scss" scoped>
.inbox-page {
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
  position: relative;
}

.mail-list {
  padding: 8px;
}

.pagination {
  padding: 16px;
  text-align: center;
  border-top: 1px solid #F0F0F0;
  background: white;
}

.export-progress-container {
  padding: 20px 0;
}

.progress-message {
  margin-top: 16px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
  text-align: center;
}

.progress-detail {
  margin: 0;
  font-size: 12px;
  color: #999;
  text-align: center;
}
</style>
