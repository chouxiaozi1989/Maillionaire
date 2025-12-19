<template>
  <a-modal
    :open="visible"
    title="系统设置"
    :width="1000"
    :footer="null"
    @cancel="handleClose"
    class="settings-modal"
  >
    <a-layout class="settings-layout">
      <!-- 左侧导航 -->
      <a-layout-sider :width="180" class="settings-sidebar" theme="light">
        <a-menu
          v-model:selectedKeys="selectedMenu"
          mode="inline"
          class="settings-menu"
        >
          <a-menu-item key="general">
            <template #icon>
              <SettingOutlined />
            </template>
            通用设置
          </a-menu-item>

          <a-menu-item key="accounts">
            <template #icon>
              <UserOutlined />
            </template>
            账户管理
          </a-menu-item>

          <a-menu-item key="proxy">
            <template #icon>
              <GlobalOutlined />
            </template>
            代理设置
          </a-menu-item>

          <a-menu-item key="about">
            <template #icon>
              <InfoCircleOutlined />
            </template>
            关于
          </a-menu-item>
        </a-menu>
      </a-layout-sider>

      <!-- 右侧内容 -->
      <a-layout-content class="settings-content">
        <!-- 通用设置 -->
        <div v-if="selectedMenu[0] === 'general'" class="settings-panel">
          <h3 class="panel-title">通用设置</h3>

          <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
            <a-form-item label="主题模式">
              <a-select v-model:value="settings.theme" style="width: 180px">
                <a-select-option value="light">浅色</a-select-option>
                <a-select-option value="dark">深色</a-select-option>
                <a-select-option value="auto">跟随系统</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="语言">
              <a-select v-model:value="settings.language" style="width: 180px">
                <a-select-option value="zh-CN">简体中文</a-select-option>
                <a-select-option value="en-US">English</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="每页显示邮件数">
              <a-input-number v-model:value="settings.pageSize" :min="10" :max="100" />
            </a-form-item>

            <a-form-item label="每次拉取邮件数">
              <a-input-number v-model:value="settings.fetchMailLimit" :min="10" :max="200" :step="10" />
              <div style="margin-top: 4px; color: #8C8C8C; font-size: 12px;">
                每次从服务器拉取的邮件数量，默认50封
              </div>
            </a-form-item>

            <a-form-item label="自动同步">
              <a-switch v-model:checked="settings.autoSync" />
              <span style="margin-left: 8px; color: #8C8C8C; font-size: 12px;">
                每 {{ settings.syncInterval }} 分钟同步
              </span>
            </a-form-item>

            <a-form-item v-if="settings.autoSync" label="同步间隔（分钟）">
              <a-slider
                v-model:value="settings.syncInterval"
                :min="1"
                :max="60"
                :marks="{ 5: '5', 15: '15', 30: '30', 60: '60' }"
              />
            </a-form-item>

            <a-form-item :wrapper-col="{ offset: 8 }">
              <a-space>
                <a-button type="primary" @click="handleSaveSettings">保存设置</a-button>
                <a-button @click="handleClose">取消</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </div>

        <!-- 账户管理 -->
        <div v-if="selectedMenu[0] === 'accounts'" class="settings-panel">
          <h3 class="panel-title">账户管理</h3>

          <a-button type="primary" style="margin-bottom: 16px" @click="handleAddAccount">
            <template #icon>
              <PlusOutlined />
            </template>
            添加账户
          </a-button>

          <a-table
            :columns="accountColumns"
            :data-source="accounts"
            :pagination="{ pageSize: 5 }"
            row-key="id"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'email'">
                <a-space>
                  <a-avatar :size="32" :style="{ backgroundColor: getAvatarColor(record.email) }">
                    {{ record.email.charAt(0).toUpperCase() }}
                  </a-avatar>
                  <div>
                    <div><strong>{{ record.email }}</strong></div>
                    <div style="font-size: 12px; color: #8C8C8C;">
                      {{ record.name || record.email.split('@')[0] }}
                    </div>
                  </div>
                </a-space>
              </template>
              <template v-else-if="column.key === 'type'">
                <a-tag :color="getTypeColor(record.type)">
                  {{ getTypeName(record.type) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-space>
                  <a-badge :status="record.connected ? 'success' : 'default'" />
                  <span>{{ record.connected ? '已连接' : '未连接' }}</span>
                  <a-tag v-if="record.oauth2" color="blue" size="small">OAuth2</a-tag>
                </a-space>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button
                    type="link"
                    size="small"
                    @click="handleSwitchAccount(record)"
                    :disabled="currentAccountId === record.id"
                  >
                    {{ currentAccountId === record.id ? '当前' : '切换' }}
                  </a-button>
                  <a-button type="link" size="small" @click="handleEditAccount(record)">
                    编辑
                  </a-button>
                  <a-button
                    type="link"
                    size="small"
                    @click="handleTestConnection(record)"
                    :loading="testingAccountId === record.id"
                  >
                    测试
                  </a-button>
                  <a-popconfirm
                    title="确定要删除这个账户吗？"
                    ok-text="确定"
                    cancel-text="取消"
                    @confirm="handleDeleteAccount(record.id)"
                  >
                    <a-button type="link" size="small" danger>
                      删除
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>

        <!-- 代理设置 -->
        <div v-if="selectedMenu[0] === 'proxy'" class="settings-panel">
          <h3 class="panel-title">全局代理设置</h3>

          <a-alert
            message="全局代理说明"
            type="info"
            show-icon
            style="margin-bottom: 24px"
          >
            <template #description>
              <p style="margin: 0;">全局代理设置将应用于所有未配置独立代理的账户。</p>
              <p style="margin: 8px 0 0 0;">如果账户启用了"使用独立代理设置"，则该账户将忽略此全局设置。</p>
            </template>
          </a-alert>

          <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
            <a-form-item label="启用全局代理">
              <a-switch v-model:checked="proxySettings.enabled" />
              <span style="margin-left: 8px; color: #8C8C8C; font-size: 12px;">
                未配置独立代理的账户将使用此设置
              </span>
            </a-form-item>

            <a-form-item label="代理协议">
              <a-select
                v-model:value="proxySettings.protocol"
                style="width: 180px"
                :disabled="!proxySettings.enabled"
              >
                <a-select-option value="http">HTTP</a-select-option>
                <a-select-option value="https">HTTPS</a-select-option>
                <a-select-option value="socks5">SOCKS5</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="服务器地址">
              <a-input
                v-model:value="proxySettings.host"
                placeholder="127.0.0.1"
                style="width: 250px"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-form-item label="端口">
              <a-input-number
                v-model:value="proxySettings.port"
                :min="1"
                :max="65535"
                placeholder="7890"
                style="width: 180px"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-form-item label="需要认证">
              <a-switch
                v-model:checked="proxySettings.auth.enabled"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-form-item
              v-if="proxySettings.auth.enabled"
              label="用户名"
            >
              <a-input
                v-model:value="proxySettings.auth.username"
                placeholder="输入用户名"
                style="width: 250px"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-form-item
              v-if="proxySettings.auth.enabled"
              label="密码"
            >
              <a-input-password
                v-model:value="proxySettings.auth.password"
                placeholder="输入密码"
                style="width: 250px"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-form-item :wrapper-col="{ offset: 8 }">
              <a-space>
                <a-button
                  type="primary"
                  :loading="testingProxy"
                  @click="handleTestProxy"
                >
                  测试连接
                </a-button>
                <a-button type="primary" @click="handleSaveProxy">保存设置</a-button>
                <a-button @click="handleClose">取消</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </div>

        <!-- 关于 -->
        <div v-if="selectedMenu[0] === 'about'" class="settings-panel">
          <h3 class="panel-title">关于 Maillionaire</h3>

          <div class="about-content">
            <div class="app-logo">
              <MailOutlined :style="{ fontSize: '64px', color: '#1890FF' }" />
            </div>

            <h2 class="app-name">Maillionaire</h2>
            <p class="app-version">版本 1.0.0</p>

            <a-divider />

            <div class="about-info">
              <p><strong>开发者：</strong>Maillionaire Team</p>
              <p><strong>技术栈：</strong>Vue 3 + Electron + Ant Design Vue</p>
              <p><strong>许可证：</strong>MIT License</p>
            </div>

            <a-divider />

            <div class="about-links">
              <a-space>
                <a-button type="link" href="https://github.com" target="_blank">
                  <template #icon>
                    <GithubOutlined />
                  </template>
                  GitHub
                </a-button>
                <a-button type="link">
                  <template #icon>
                    <FileTextOutlined />
                  </template>
                  帮助文档
                </a-button>
              </a-space>
            </div>
          </div>
        </div>
      </a-layout-content>
    </a-layout>

    <!-- 账户表单弹窗 -->
    <AccountFormModal
      v-model:visible="accountFormVisible"
      :account="currentAccount"
      @success="handleAccountSuccess"
    />
  </a-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  SettingOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  MailOutlined,
  GithubOutlined,
  FileTextOutlined,
  UserOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { useAppStore } from '@/stores/app'
import { useAccountStore } from '@/stores/account'
import AccountFormModal from '@/components/account/AccountFormModal.vue'

const appStore = useAppStore()
const accountStore = useAccountStore()

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  defaultMenu: {
    type: String,
    default: 'general',
  },
})

const emit = defineEmits(['update:visible'])

// 状态
const selectedMenu = ref(['general'])
const testingProxy = ref(false)
const testingAccountId = ref(null)
const accountFormVisible = ref(false)
const currentAccount = ref(null)

// 账户列表
const accounts = computed(() => accountStore.accounts)
const currentAccountId = computed(() => accountStore.currentAccountId)

// 账户表格列
const accountColumns = [
  { title: '邮箱账户', key: 'email', dataIndex: 'email', width: 220 },
  { title: '类型', key: 'type', dataIndex: 'type', width: 100 },
  { title: '状态', key: 'status', dataIndex: 'connected', width: 150 },
  { title: '操作', key: 'actions', width: 200 },
]

// 通用设置
const settings = ref({
  theme: 'light',
  language: 'zh-CN',
  pageSize: 50,
  fetchMailLimit: 50,
  autoSync: true,
  syncInterval: 15,
})

// 代理设置
const proxySettings = ref({
  enabled: false,
  protocol: 'http',
  host: '127.0.0.1',
  port: 7890,
  auth: {
    enabled: false,
    username: '',
    password: '',
  },
})

/**
 * 加载设置
 */
async function loadSettings() {
  try {
    // 加载通用设置
    settings.value = { ...settings.value, ...appStore.settings }

    // 加载代理设置
    if (window.electronAPI) {
      const config = await window.electronAPI.getProxyConfig()
      if (config) {
        proxySettings.value = config
      }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

/**
 * 保存通用设置
 */
async function handleSaveSettings() {
  try {
    appStore.saveSettings(settings.value)
    message.success('设置已保存')
  } catch (error) {
    message.error('保存失败：' + error.message)
  }
}

/**
 * 测试代理
 */
async function handleTestProxy() {
  if (!proxySettings.value.enabled) {
    message.warning('请先启用代理')
    return
  }

  try {
    testingProxy.value = true

    if (!window.electronAPI) {
      message.error('非 Electron 环境，无法测试代理')
      return
    }

    // 使用表单中的配置测试
    const configToTest = JSON.parse(JSON.stringify(proxySettings.value))
    const result = await window.electronAPI.testProxy(configToTest, 'https://www.google.com')

    if (result.success) {
      message.success(result.message || '代理连接成功')
    } else {
      message.error(result.message || '代理连接失败')
    }
  } catch (error) {
    message.error('测试失败：' + error.message)
  } finally {
    testingProxy.value = false
  }
}

/**
 * 保存代理设置
 */
async function handleSaveProxy() {
  try {
    if (!window.electronAPI) {
      message.error('非 Electron 环境，无法保存代理设置')
      return
    }

    const configToSave = JSON.parse(JSON.stringify(proxySettings.value))
    await window.electronAPI.setProxyConfig(configToSave)
    message.success('代理设置已保存')
  } catch (error) {
    message.error('保存失败：' + error.message)
  }
}

// 账户管理方法
function handleAddAccount() {
  currentAccount.value = null
  accountFormVisible.value = true
}

function handleEditAccount(account) {
  currentAccount.value = account
  accountFormVisible.value = true
}

function handleSwitchAccount(account) {
  accountStore.switchAccount(account.id)
  message.success(`已切换到账户：${account.email}`)
}

async function handleTestConnection(account) {
  try {
    testingAccountId.value = account.id
    const result = await accountStore.verifyAccount(account)

    if (result.oauth2 || (result.imap && result.smtp)) {
      message.success('连接测试成功')
      await accountStore.updateAccount(account.id, { connected: true })
    } else {
      const errors = result.errors || []
      message.error(`连接测试失败：${errors.join('; ')}`)
    }
  } catch (error) {
    message.error(`测试失败：${error.message}`)
  } finally {
    testingAccountId.value = null
  }
}

async function handleDeleteAccount(accountId) {
  try {
    await accountStore.deleteAccount(accountId)
    message.success('账户已删除')
  } catch (error) {
    message.error(`删除失败：${error.message}`)
  }
}

function handleAccountSuccess() {
  // 账户添加/编辑成功后的回调
}

function getAvatarColor(email) {
  const colors = ['#1890FF', '#FA8C16', '#52C41A', '#13C2C2', '#722ED1', '#EB2F96']
  const index = email.charCodeAt(0) % colors.length
  return colors[index]
}

function getTypeColor(type) {
  const colors = {
    gmail: 'red',
    outlook: 'blue',
    qq: 'cyan',
    163: 'green',
    126: 'orange',
  }
  return colors[type] || 'default'
}

function getTypeName(type) {
  const names = {
    gmail: 'Gmail',
    outlook: 'Outlook',
    qq: 'QQ邮箱',
    163: '163邮箱',
    126: '126邮箱',
  }
  return names[type] || type
}

/**
 * 关闭弹窗
 */
function handleClose() {
  emit('update:visible', false)
}

// 处理菜单选择事件
function handleMenuSelectEvent(event) {
  if (event.detail && event.detail.menu) {
    selectedMenu.value = [event.detail.menu]
  }
}

// 监听弹窗打开
watch(() => props.visible, (visible) => {
  if (visible) {
    loadSettings()
    // 如果指定了默认菜单，设置选中
    if (props.defaultMenu) {
      selectedMenu.value = [props.defaultMenu]
    }
  }
})

onMounted(() => {
  window.addEventListener('settings-select-menu', handleMenuSelectEvent)
})

onUnmounted(() => {
  window.removeEventListener('settings-select-menu', handleMenuSelectEvent)
})
</script>

<style lang="scss" scoped>
.settings-modal {
  :deep(.ant-modal-body) {
    padding: 0;
    max-height: 600px;
  }
}

.settings-layout {
  height: 600px;
  background: white;
}

.settings-sidebar {
  border-right: 1px solid #F0F0F0;

  .settings-menu {
    border-right: none;
    height: 100%;
  }
}

.settings-content {
  padding: 24px;
  overflow-y: auto;
}

.settings-panel {
  .panel-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 24px;
    color: #262626;
  }
}

.about-content {
  text-align: center;
  padding: 20px;

  .app-logo {
    margin-bottom: 20px;
  }

  .app-name {
    font-size: 28px;
    font-weight: 600;
    margin: 10px 0;
    color: #262626;
  }

  .app-version {
    font-size: 14px;
    color: #8C8C8C;
    margin-bottom: 20px;
  }

  .about-info {
    text-align: left;
    max-width: 400px;
    margin: 20px auto;

    p {
      margin: 12px 0;
      color: #595959;

      strong {
        color: #262626;
        margin-right: 8px;
      }
    }
  }

  .about-links {
    margin-top: 20px;
  }
}
</style>
