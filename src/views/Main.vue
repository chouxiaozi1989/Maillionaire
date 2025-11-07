<template>
  <div class="main-layout">
    <!-- 顶部导航栏 -->
    <a-layout-header class="main-header">
      <div class="header-left">
        <div class="logo">
          <MailOutlined :style="{ fontSize: '24px', color: 'white' }" />
        </div>
        <span class="app-name">Maillionaire</span>
      </div>

      <div class="header-center">
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索邮件..."
          class="search-box"
          @search="handleSearch"
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input-search>
      </div>

      <div class="header-right">
        <a-button type="primary" size="large" @click="showComposeModal = true">
          <template #icon>
            <EditOutlined />
          </template>
          写邮件
        </a-button>
        <a-button type="text" size="large" @click="handleSync">
          <template #icon>
            <ReloadOutlined :spin="syncing" />
          </template>
        </a-button>
        <a-button type="text" size="large" @click="handleSettings">
          <template #icon>
            <SettingOutlined />
          </template>
        </a-button>
      </div>
    </a-layout-header>

    <a-layout class="main-content">
      <!-- 左侧边栏 -->
      <a-layout-sider :width="240" class="sidebar" theme="light">
        <!-- 账户选择 -->
        <div class="account-selector">
          <a-select
            v-model:value="currentAccountId"
            class="account-dropdown"
            @change="handleAccountChange"
          >
            <a-select-option
              v-for="account in accounts"
              :key="account.id"
              :value="account.id"
            >
              <a-avatar :size="24" :style="{ backgroundColor: getAvatarColor(account.email) }">
                {{ getInitial(account.email) }}
              </a-avatar>
              <span class="account-email">{{ account.email }}</span>
            </a-select-option>
          </a-select>
        </div>

        <!-- 文件夹列表 -->
        <a-menu
          v-model:selectedKeys="selectedFolders"
          mode="inline"
          class="folder-menu"
          style="flex: 1; overflow-y: auto; border-right: none;"
          @select="handleFolderSelect"
        >
          <a-menu-item key="inbox">
            <template #icon>
              <InboxOutlined />
            </template>
            收件箱
            <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
          </a-menu-item>

          <a-menu-item key="sent">
            <template #icon>
              <SendOutlined />
            </template>
            已发送
          </a-menu-item>

          <a-menu-item key="drafts">
            <template #icon>
              <FileOutlined />
            </template>
            草稿箱
          </a-menu-item>

          <a-menu-item key="trash">
            <template #icon>
              <DeleteOutlined />
            </template>
            回收站
          </a-menu-item>

          <a-menu-item key="starred">
            <template #icon>
              <StarOutlined />
            </template>
            星标邮件
          </a-menu-item>

          <!-- 自定义文件夹 -->
          <a-menu-divider v-if="customFolders.length > 0" />
          <a-menu-item
            v-for="folder in customFolders"
            :key="folder.id"
          >
            <template #icon>
              <FolderOutlined />
            </template>
            {{ folder.name }}
          </a-menu-item>
        </a-menu>

        <!-- 文件夹管理按钮 -->
        <div class="folder-actions">
          <a-button type="text" size="small" @click="showFolderModal = true">
            <template #icon>
              <PlusOutlined />
            </template>
            新建文件夹
          </a-button>
          <a-button 
            type="text" 
            size="small" 
            :loading="mailStore.isSyncing"
            @click="handleSyncFolders"
          >
            <template #icon>
              <ReloadOutlined />
            </template>
            同步
          </a-button>
        </div>

        <!-- 存储空间 -->
        <div class="storage-info">
          <div class="storage-text">
            <span>已使用 {{ usedStorage }}</span>
            <span>共 {{ totalStorage }}</span>
          </div>
          <a-progress
            :percent="storagePercent"
            :show-info="false"
            stroke-color="#1890FF"
          />
        </div>
      </a-layout-sider>

      <!-- 主内容区域 -->
      <a-layout-content class="content-area">
        <router-view />
      </a-layout-content>
    </a-layout>

    <!-- 撰写邮件弹窗 -->
    <ComposeModal v-model:visible="showComposeModal" />
    
    <!-- 系统设置弹窗 -->
    <SettingsModal v-model:visible="showSettingsModal" />

    <!-- 新建文件夹弹窗 -->
    <a-modal
      v-model:open="showFolderModal"
      title="新建文件夹"
      @ok="handleCreateFolder"
    >
      <a-input
        v-model:value="newFolderName"
        placeholder="请输入文件夹名称"
        @press-enter="handleCreateFolder"
      />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  MailOutlined,
  SearchOutlined,
  EditOutlined,
  ReloadOutlined,
  SettingOutlined,
  InboxOutlined,
  SendOutlined,
  FileOutlined,
  DeleteOutlined,
  StarOutlined,
  FolderOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { useAccountStore } from '@/stores/account'
import { useMailStore } from '@/stores/mail'
import { useAppStore } from '@/stores/app'
import ComposeModal from '@/components/mail/ComposeModal.vue'
import SettingsModal from '@/components/settings/SettingsModal.vue'

const router = useRouter()
const accountStore = useAccountStore()
const mailStore = useMailStore()
const appStore = useAppStore()

// 状态
const searchKeyword = ref('')
const showComposeModal = ref(false)
const showSettingsModal = ref(false)
const showFolderModal = ref(false)
const newFolderName = ref('')
const syncing = ref(false)
const selectedFolders = ref(['inbox'])

// 计算属性
const accounts = computed(() => accountStore.accounts)
const currentAccountId = computed({
  get: () => accountStore.currentAccountId,
  set: (val) => accountStore.switchAccount(val),
})
const unreadCount = computed(() => mailStore.unreadCount)
const customFolders = computed(() => {
  return mailStore.folders.filter(f => !f.system)
})

// 存储空间（模拟数据）
const usedStorage = ref('3.5 GB')
const totalStorage = ref('10 GB')
const storagePercent = ref(35)

/**
 * 获取头像颜色
 */
function getAvatarColor(email) {
  const colors = ['#1890FF', '#FA8C16', '#52C41A', '#13C2C2', '#722ED1']
  const index = email.charCodeAt(0) % colors.length
  return colors[index]
}

/**
 * 获取首字母
 */
function getInitial(email) {
  return email.charAt(0).toUpperCase()
}

/**
 * 搜索邮件
 */
function handleSearch(value) {
  console.log('Search:', value)
  // TODO: 实现搜索功能
  message.info('搜索功能开发中...')
}

/**
 * 同步邮件
 */
async function handleSync() {
  try {
    syncing.value = true
    const account = accountStore.currentAccount
    
    if (!account) {
      message.error('请先选择一个账户')
      return
    }
    
    // 1. 同步账户连接
    const loadingMsg = message.loading('正在同步账户...', 0)
    
    try {
      const result = await accountStore.syncAccount(account.id)
      loadingMsg()
      
      if (result.imap && result.smtp) {
        message.success('账户连接验证成功')
        
        // 2. 同步文件夹
        const folderMsg = message.loading('正在同步文件夹...', 0)
        try {
          await mailStore.syncServerFolders()
          folderMsg()
          message.success('文件夹同步成功')
        } catch (error) {
          folderMsg()
          console.error('Folder sync failed:', error)
          message.warning('文件夹同步失败：' + error.message)
        }
        
        // 3. 拉取最新邮件
        const mailMsg = message.loading('正在拉取最新邮件...', 0)
        try {
          const newMails = await mailStore.fetchMailsFromServer('INBOX', {
            limit: appStore.settings.fetchMailLimit || 50,
            unreadOnly: false,
          })
          mailMsg()

          if (newMails && newMails.length > 0) {
            message.success(`成功拉取 ${newMails.length} 封新邮件`)
          } else {
            message.info('没有新邮件')
          }
        } catch (error) {
          mailMsg()
          console.error('Mail fetch failed:', error)
          message.warning('邮件拉取失败：' + error.message)
        }
        
      } else {
        const errorMsg = result.errors?.join('; ') || '未知错误'
        message.error(`账户连接失败: ${errorMsg}`)
      }
    } catch (error) {
      loadingMsg()
      throw error
    }
  } catch (error) {
    console.error('Sync failed:', error)
    message.error('同步失败：' + error.message)
  } finally {
    syncing.value = false
  }
}

/**
 * 打开设置
 */
function handleSettings() {
  showSettingsModal.value = true
}

/**
 * 账户切换
 */
async function handleAccountChange(accountId) {
  try {
    accountStore.switchAccount(accountId)
    
    console.log(`[Main] Switching to account ${accountId}`)
    
    // 重新加载该账户的文件夹列表
    await mailStore.loadFolders()
    
    // 重新加载邮件
    await mailStore.loadMails('inbox')
    
    // 重置选中的文件夹为收件箱
    selectedFolders.value = ['inbox']
    
    // 如果当前不在收件箱页面，跳转到收件箱
    if (router.currentRoute.value.path !== '/main/inbox') {
      router.push('/main/inbox')
    }
    
    message.success('已切换账户')
  } catch (error) {
    console.error('Switch account failed:', error)
    message.error('切换账户失败：' + error.message)
  }
}

/**
 * 文件夹选择
 */
function handleFolderSelect({ key }) {
  router.push(`/main/${key}`)
  mailStore.switchFolder(key)
}

/**
 * 同步服务器文件夹
 */
async function handleSyncFolders() {
  try {
    await mailStore.syncServerFolders()
    message.success('文件夹同步成功')
  } catch (error) {
    message.error('同步失败：' + error.message)
  }
}

/**
 * 创建文件夹
 */
async function handleCreateFolder() {
  if (!newFolderName.value.trim()) {
    message.warning('请输入文件夹名称')
    return
  }
  
  try {
    await mailStore.createFolder(newFolderName.value)
    message.success('文件夹创建成功')
    showFolderModal.value = false
    newFolderName.value = ''
  } catch (error) {
    message.error('创建失败：' + error.message)
  }
}

// 初始化
onMounted(async () => {
  await accountStore.loadAccounts()
  await mailStore.loadFolders()
  if (accountStore.currentAccount) {
    await mailStore.loadMails('inbox')
  }
})
</script>

<style lang="scss" scoped>
.main-layout {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-header {
  height: 64px;
  padding: 0 24px;
  background: #1890FF;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 40px;
}

.search-box {
  width: 100%;
  max-width: 500px;
  
  :deep(.ant-input-affix-wrapper) {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    
    &:hover, &:focus {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }
    
    input {
      background: transparent;
      color: white;
      
      &::placeholder {
        color: rgba(255, 255, 255, 0.7);
      }
    }
    
    .anticon {
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  
  :deep(.ant-btn-text) {
    color: white;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.sidebar {
  border-right: 1px solid #F0F0F0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  /* 确保 ant-layout-sider 内容正确显示 */
  :deep(.ant-layout-sider-children) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

.account-selector {
  padding: 16px;
  border-bottom: 1px solid #F0F0F0;
}

.account-dropdown {
  width: 100%;
  
  :deep(.ant-select-selector) {
    border-radius: 8px;
  }
}

.account-email {
  margin-left: 8px;
  font-size: 14px;
}

.folder-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto !important;
  overflow-x: hidden;
  min-height: 0;
  max-height: 100%;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #F5F5F5;
  }

  &::-webkit-scrollbar-thumb {
    background: #D9D9D9;
    border-radius: 3px;

    &:hover {
      background: #BFBFBF;
    }
  }

  /* 确保 ant-menu 内部元素也支持滚动 */
  :deep(.ant-menu) {
    border-right: none;
  }

  :deep(ul) {
    max-height: 100%;
    overflow-y: auto;
  }

  :deep(.ant-menu-item) {
    display: flex;
    align-items: center;
    margin: 4px 8px;
    border-radius: 6px;

    &.ant-menu-item-selected {
      background: #E6F7FF;
      color: #1890FF;
    }
  }
}

.unread-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: #FF4D4F;
  color: white;
  border-radius: 10px;
  font-size: 12px;
}

.folder-actions {
  padding: 8px;
  border-top: 1px solid #F0F0F0;
  display: flex;
  gap: 4px;
  
  :deep(.ant-btn) {
    flex: 1;
    font-size: 12px;
  }
}

.storage-info {
  padding: 16px;
  border-top: 1px solid #F0F0F0;
}

.storage-text {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8C8C8C;
  margin-bottom: 8px;
}

.content-area {
  background: #F0F2F5;
  overflow: hidden;
}
</style>
