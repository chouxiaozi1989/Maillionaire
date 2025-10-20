<template>
  <div class="sent-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
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
            @click="handleMailClick(mail)"
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
import { ReloadOutlined } from '@ant-design/icons-vue'
import { useMailStore } from '@/stores/mail'
import MailItem from '@/components/mail/MailItem.vue'
import MailDetailModal from '@/components/mail/MailDetailModal.vue'

const mailStore = useMailStore()

const loading = ref(false)
const dateRange = ref('all')
const showDetailModal = ref(false)
const selectedMail = ref(null)

const sentMails = computed(() => mailStore.currentMails)

async function loadMails() {
  try {
    loading.value = true
    await mailStore.loadMails('sent')
  } catch (error) {
    message.error('加载邮件失败：' + error.message)
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  mailStore.updateFilter({ dateRange: dateRange.value })
}

async function handleRefresh() {
  await loadMails()
  message.success('刷新成功')
}

function handleMailClick(mail) {
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
  mailStore.switchFolder('sent')
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
}

.mail-list {
  padding: 8px;
}
</style>
