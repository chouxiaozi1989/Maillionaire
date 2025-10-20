<template>
  <div class="inbox-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
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
            @click="handleMailClick(mail)"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import MailItem from '@/components/mail/MailItem.vue'
import MailDetailModal from '@/components/mail/MailDetailModal.vue'

const mailStore = useMailStore()

// 状态
const loading = ref(false)
const filterType = ref('all')
const dateRange = ref('all')
const limit = ref(50)
const currentPage = ref(1)
const pageSize = ref(20)
const showDetailModal = ref(false)
const selectedMail = ref(null)

// 计算属性
const mails = computed(() => mailStore.currentMails)
const totalMails = computed(() => mails.value.length)

/**
 * 加载邮件
 */
async function loadMails() {
  try {
    loading.value = true
    await mailStore.loadMails('inbox')
  } catch (error) {
    message.error('加载邮件失败：' + error.message)
  } finally {
    loading.value = false
  }
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
  await loadMails()
  message.success('刷新成功')
}

/**
 * 邮件点击
 */
function handleMailClick(mail) {
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
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid #F0F0F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
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
</style>
