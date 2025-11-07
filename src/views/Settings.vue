<template>
  <div class="settings-page">
    <a-layout class="settings-layout">
      <!-- 左侧导航 -->
      <a-layout-sider :width="200" class="settings-sidebar" theme="light">
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

          <a-menu-item key="proxy">
            <template #icon>
              <GlobalOutlined />
            </template>
            代理设置
          </a-menu-item>

          <a-menu-item key="accounts">
            <template #icon>
              <UserOutlined />
            </template>
            账户管理
          </a-menu-item>

          <a-menu-item key="templates">
            <template #icon>
              <FileTextOutlined />
            </template>
            邮件模板
          </a-menu-item>

          <a-menu-item key="signatures">
            <template #icon>
              <EditOutlined />
            </template>
            签名管理
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
          <h2 class="panel-title">通用设置</h2>

          <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
            <a-form-item label="主题模式">
              <a-select v-model:value="settings.theme" style="width: 200px">
                <a-select-option value="light">浅色</a-select-option>
                <a-select-option value="dark">深色</a-select-option>
                <a-select-option value="auto">跟随系统</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="语言">
              <a-select v-model:value="settings.language" style="width: 200px">
                <a-select-option value="zh-CN">简体中文</a-select-option>
                <a-select-option value="en-US">English</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="每页显示邮件数">
              <a-input-number v-model:value="settings.pageSize" :min="10" :max="100" />
            </a-form-item>

            <a-form-item label="自动同步">
              <a-switch v-model:checked="settings.autoSync" />
              <span style="margin-left: 8px; color: #8C8C8C;">
                每 {{ settings.syncInterval }} 分钟自动同步一次
              </span>
            </a-form-item>

            <a-form-item v-if="settings.autoSync" label="同步间隔">
              <a-slider v-model:value="settings.syncInterval" :min="1" :max="60" :marks="{ 5: '5分钟', 30: '30分钟', 60: '60分钟' }" />
            </a-form-item>

            <a-form-item label="删除同步到服务器">
              <a-switch v-model:checked="settings.syncDeleteToServer" />
              <span style="margin-left: 8px; color: #8C8C8C;">
                关闭后，删除邮件仅在本地生效，不会同步到服务器
              </span>
            </a-form-item>

            <a-form-item :wrapper-col="{ offset: 6 }">
              <a-button type="primary" @click="handleSaveSettings">保存设置</a-button>
            </a-form-item>
          </a-form>
        </div>

        <!-- 代理设置 -->
        <div v-if="selectedMenu[0] === 'proxy'" class="settings-panel">
          <h2 class="panel-title">代理设置</h2>

          <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
            <a-form-item label="启用代理">
              <a-switch v-model:checked="proxySettings.enabled" />
              <span style="margin-left: 8px; color: #8C8C8C;">
                启用后所有网络连接将通过代理服务器
              </span>
            </a-form-item>

            <a-form-item label="代理协议">
              <a-select 
                v-model:value="proxySettings.protocol" 
                style="width: 200px"
                :disabled="!proxySettings.enabled"
              >
                <a-select-option value="http">HTTP</a-select-option>
                <a-select-option value="https">HTTPS</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="服务器地址">
              <a-input 
                v-model:value="proxySettings.host" 
                placeholder="127.0.0.1"
                style="width: 300px"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-form-item label="端口">
              <a-input-number 
                v-model:value="proxySettings.port" 
                :min="1" 
                :max="65535"
                placeholder="7890"
                style="width: 200px"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-form-item label="认证">
              <a-switch 
                v-model:checked="proxySettings.auth.enabled" 
                :disabled="!proxySettings.enabled"
              />
              <span style="margin-left: 8px; color: #8C8C8C;">
                如果代理服务器需要身份验证，请启用
              </span>
            </a-form-item>

            <a-form-item 
              v-if="proxySettings.auth.enabled" 
              label="用户名"
            >
              <a-input 
                v-model:value="proxySettings.auth.username" 
                placeholder="输入用户名"
                style="width: 300px"
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
                style="width: 300px"
                :disabled="!proxySettings.enabled"
              />
            </a-form-item>

            <a-divider style="margin: 24px 0" />

            <a-form-item label="测试 URL">
              <a-input 
                v-model:value="testUrl" 
                placeholder="https://www.google.com"
                style="width: 400px"
              >
                <template #addonAfter>
                  <a-button 
                    type="link" 
                    size="small" 
                    @click="testUrl = 'https://www.google.com'"
                    style="padding: 0 8px"
                  >
                    重置
                  </a-button>
                </template>
              </a-input>
              <div style="margin-top: 4px; color: #8C8C8C; font-size: 12px;">
                用于测试代理连接的 URL，支持 HTTP 和 HTTPS 协议
                <br/>
                💡 提示：如果 HTTPS 测试失败（TLS 错误），请使用 HTTP URL（如 <span style="color: #1890FF;">http://www.baidu.com</span>）
              </div>
            </a-form-item>

            <a-form-item :wrapper-col="{ offset: 6 }">
              <a-space>
                <a-button type="primary" @click="handleSaveProxySettings">保存设置</a-button>
                <a-button @click="handleTestProxy" :loading="testingProxy">测试连接</a-button>
                <a-button @click="handleResetProxy">重置为默认</a-button>
              </a-space>
            </a-form-item>

            <a-alert
              v-if="proxySettings.enabled"
              message="代理配置信息"
              type="info"
              show-icon
              style="margin-top: 16px"
            >
              <template #description>
                <p><strong>当前代理：</strong> {{ getProxyUrl() }}</p>
                <p style="margin-top: 8px; color: #8C8C8C;">
                  注意：修改代理设置后需要重启应用才能全面生效
                </p>
              </template>
            </a-alert>
          </a-form>
        </div>

        <!-- 账户管理 -->
        <div v-if="selectedMenu[0] === 'accounts'" class="settings-panel">
          <h2 class="panel-title">账户管理</h2>

          <a-button type="primary" style="margin-bottom: 16px" @click="handleAddAccount">
            <template #icon>
              <PlusOutlined />
            </template>
            添加账户
          </a-button>

          <a-list :data-source="accounts" item-layout="horizontal">
            <template #renderItem="{ item }">
              <a-list-item>
                <template #actions>
                  <a-button type="link" @click="handleEditAccount(item)">编辑</a-button>
                  <a-popconfirm
                    title="确定要删除这个账户吗？"
                    @confirm="handleDeleteAccount(item.id)"
                  >
                    <a-button type="link" danger>删除</a-button>
                  </a-popconfirm>
                </template>
                <a-list-item-meta>
                  <template #avatar>
                    <a-avatar :style="{ backgroundColor: '#1890FF' }">
                      {{ item.email.charAt(0).toUpperCase() }}
                    </a-avatar>
                  </template>
                  <template #title>
                    {{ item.email }}
                  </template>
                  <template #description>
                    {{ item.type }} • {{ item.connected ? '已连接' : '未连接' }}
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </div>

        <!-- 邮件模板 -->
        <div v-if="selectedMenu[0] === 'templates'" class="settings-panel">
          <h2 class="panel-title">邮件模板</h2>

          <a-button type="primary" style="margin-bottom: 16px" @click="handleAddTemplate">
            <template #icon>
              <PlusOutlined />
            </template>
            新建模板
          </a-button>

          <a-table
            :columns="templateColumns"
            :data-source="templates"
            :pagination="{ pageSize: 10 }"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <strong>{{ record.name }}</strong>
              </template>
              <template v-else-if="column.key === 'subject'">
                <span style="color: #8C8C8C;">{{ record.subject || '（无主题）' }}</span>
              </template>
              <template v-else-if="column.key === 'updatedAt'">
                {{ formatDate(record.updatedAt) }}
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="handleEditTemplate(record)">
                    编辑
                  </a-button>
                  <a-button type="link" size="small" @click="handlePreviewTemplate(record)">
                    预览
                  </a-button>
                  <a-popconfirm
                    title="确定要删除这个模板吗？"
                    @confirm="handleDeleteTemplate(record.id)"
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

        <!-- 签名管理 -->
        <div v-if="selectedMenu[0] === 'signatures'" class="settings-panel">
          <h2 class="panel-title">签名管理</h2>

          <a-button type="primary" style="margin-bottom: 16px" @click="handleAddSignature">
            <template #icon>
              <PlusOutlined />
            </template>
            新建签名
          </a-button>

          <a-table
            :columns="signatureColumns"
            :data-source="signatures"
            :pagination="{ pageSize: 10 }"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <a-space>
                  <strong>{{ record.name }}</strong>
                  <a-tag v-if="record.id === defaultSignatureId" color="blue">
                    默认
                  </a-tag>
                </a-space>
              </template>
              <template v-else-if="column.key === 'preview'">
                <div
                  class="signature-preview"
                  v-html="sanitizeHtml(record.content)"
                ></div>
              </template>
              <template v-else-if="column.key === 'updatedAt'">
                {{ formatDate(record.updatedAt) }}
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button
                    v-if="record.id !== defaultSignatureId"
                    type="link"
                    size="small"
                    @click="handleSetDefaultSignature(record.id)"
                  >
                    设为默认
                  </a-button>
                  <a-button type="link" size="small" @click="handleEditSignature(record)">
                    编辑
                  </a-button>
                  <a-popconfirm
                    title="确定要删除这个签名吗？"
                    @confirm="handleDeleteSignature(record.id)"
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

        <!-- 关于 -->
        <div v-if="selectedMenu[0] === 'about'" class="settings-panel">
          <div class="about-content">
            <div class="about-logo">
              <MailOutlined :style="{ fontSize: '64px', color: '#1890FF' }" />
            </div>
            <h1 class="about-title">{{ APP_VERSION.name }}</h1>
            <p class="about-subtitle">{{ APP_VERSION.description }}</p>
            <p class="about-version">{{ APP_VERSION.fullVersionString }}</p>

            <a-divider />

            <div class="about-info">
              <p><strong>技术栈:</strong></p>
              <p>Electron + Vue 3 + Ant Design Vue</p>
              <br>
              <p><strong>开源许可:</strong></p>
              <p>MIT License</p>
              <br>
              <p><strong>官网:</strong></p>
              <p><a href="#">https://maillionaire.com</a></p>
            </div>
          </div>
        </div>
      </a-layout-content>
    </a-layout>

    <!-- 模板编辑弹窗 -->
    <TemplateFormModal
      v-model:visible="templateFormVisible"
      :template="currentTemplate"
      @submit="handleTemplateSubmit"
    />

    <!-- 签名编辑弹窗 -->
    <SignatureFormModal
      v-model:visible="signatureFormVisible"
      :signature="currentSignature"
      @submit="handleSignatureSubmit"
    />

    <!-- 账户表单弹窗 -->
    <AccountFormModal
      v-model:visible="accountFormVisible"
      :account="currentAccount"
      @success="handleAccountSubmit"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  SettingOutlined,
  UserOutlined,
  FileTextOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  MailOutlined,
  GlobalOutlined,
} from '@ant-design/icons-vue'
import DOMPurify from 'dompurify'
import dayjs from 'dayjs'
import { useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'
import { useTemplateStore } from '@/stores/template'
import { useSignatureStore } from '@/stores/signature'
import TemplateFormModal from '@/components/template/TemplateFormModal.vue'
import SignatureFormModal from '@/components/signature/SignatureFormModal.vue'
import AccountFormModal from '@/components/account/AccountFormModal.vue'
import APP_VERSION from '@/config/version'
import proxyConfig from '@/config/proxy'

const router = useRouter()
const appStore = useAppStore()
const accountStore = useAccountStore()
const templateStore = useTemplateStore()
const signatureStore = useSignatureStore()

const selectedMenu = ref(['general'])
const settings = ref({
  theme: 'light',
  language: 'zh-CN',
  pageSize: appStore.settings.pageSize || 20,
  autoSync: appStore.settings.autoSync,
  syncInterval: appStore.settings.syncInterval || 15,
  syncDeleteToServer: appStore.settings.syncDeleteToServer,
})

// 账户相关
const accountFormVisible = ref(false)
const currentAccount = ref(null)

// 代理设置
const proxySettings = ref(proxyConfig.getConfig())
const testingProxy = ref(false)
const testUrl = ref('https://www.google.com')

// 模板相关
const templateFormVisible = ref(false)
const currentTemplate = ref(null)
const templateColumns = [
  { title: '模板名称', key: 'name', dataIndex: 'name' },
  { title: '邮件主题', key: 'subject', dataIndex: 'subject' },
  { title: '更新时间', key: 'updatedAt', dataIndex: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', width: 200 },
]

// 签名相关
const signatureFormVisible = ref(false)
const currentSignature = ref(null)
const signatureColumns = [
  { title: '签名名称', key: 'name', dataIndex: 'name', width: 200 },
  { title: '签名预览', key: 'preview', dataIndex: 'content' },
  { title: '更新时间', key: 'updatedAt', dataIndex: 'updatedAt', width: 180 },
  { title: '操作', key: 'actions', width: 220 },
]

const accounts = computed(() => accountStore.accounts)
const templates = computed(() => templateStore.templates)
const signatures = computed(() => signatureStore.signatures)
const defaultSignatureId = computed(() => signatureStore.defaultSignatureId)

onMounted(async () => {
  await Promise.all([
    templateStore.loadTemplates(),
    signatureStore.loadSignatures(),
  ])
})

function handleSaveSettings() {
  // Save settings to app store
  appStore.saveSettings({
    pageSize: settings.value.pageSize,
    autoSync: settings.value.autoSync,
    syncInterval: settings.value.syncInterval,
    syncDeleteToServer: settings.value.syncDeleteToServer,
  })
  message.success('设置已保存')
}

// 代理设置方法
async function handleSaveProxySettings() {
  try {
    const success = await proxyConfig.saveConfig(proxySettings.value)
    if (success) {
      message.success('代理设置已保存')
    } else {
      message.error('保存失败')
    }
  } catch (error) {
    console.error('Save proxy config error:', error)
    message.error(`保存失败：${error.message}`)
  }
}

async function handleTestProxy() {
  if (!proxySettings.value.enabled) {
    message.warning('请先启用代理')
    return
  }
  
  // 验证测试 URL
  if (!testUrl.value || !testUrl.value.trim()) {
    message.warning('请输入测试 URL')
    return
  }
  
  // 简单的 URL 格式验证
  try {
    new URL(testUrl.value)
  } catch (error) {
    message.warning('请输入有效的 URL（如 https://www.google.com）')
    return
  }
  
  testingProxy.value = true
  try {
    const result = await proxyConfig.testConnection(testUrl.value)
    if (result.success) {
      message.success(`代理连接测试成功 (${result.status || 200})`)
    } else {
      message.error(`连接失败：${result.message}`)
    }
  } catch (error) {
    message.error(`测试失败：${error.message}`)
  } finally {
    testingProxy.value = false
  }
}

async function handleResetProxy() {
  try {
    await proxyConfig.resetConfig()
    proxySettings.value = proxyConfig.getConfig()
    message.success('已重置为默认设置')
  } catch (error) {
    console.error('Reset proxy config error:', error)
    message.error(`重置失败：${error.message}`)
  }
}

function getProxyUrl() {
  const { protocol, host, port, auth } = proxySettings.value
  if (auth.enabled && auth.username) {
    return `${protocol}://${auth.username}:***@${host}:${port}`
  }
  return `${protocol}://${host}:${port}`
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

async function handleAccountSubmit(account) {
  // 账户添加/编辑成功后，如果是新账户，切换到新账户
  if (account && !currentAccount.value) {
    accountStore.switchAccount(account.id)
    message.success('已切换到新账户')
  }
}

async function handleDeleteAccount(accountId) {
  try {
    const loadingMsg = message.loading('正在删除账户...', 0)
    
    // 删除账户（会自动清空邮件和文件夹）
    const result = await accountStore.deleteAccount(accountId)
    
    loadingMsg()
    message.success('账户已删除')
    
    // 如果删除的是当前账户，需要重置界面
    if (result.isDeletingCurrentAccount) {
      console.log('[Settings] Current account deleted, redirecting...')
      
      // 如果还有其他账户，跳转到收件箱
      if (accountStore.accounts.length > 0) {
        await router.push('/main/inbox')
      } else {
        // 没有账户了，跳转到登录页
        await router.push('/login')
      }
    }
  } catch (error) {
    console.error('[Settings] Delete account failed:', error)
    message.error(`删除失败：${error.message}`)
  }
}

// 模板管理方法
function handleAddTemplate() {
  currentTemplate.value = null
  templateFormVisible.value = true
}

function handleEditTemplate(template) {
  currentTemplate.value = template
  templateFormVisible.value = true
}

async function handleTemplateSubmit(data) {
  try {
    if (data.id) {
      await templateStore.updateTemplate(data.id, {
        name: data.name,
        subject: data.subject,
        body: data.body,
      })
    } else {
      await templateStore.addTemplate(data)
    }
  } catch (error) {
    message.error('操作失败')
  }
}

function handlePreviewTemplate(template) {
  // 显示模板预览（可以使用模态框）
  message.info('预览功能开发中...')
}

async function handleDeleteTemplate(templateId) {
  try {
    await templateStore.deleteTemplate(templateId)
    message.success('模板已删除')
  } catch (error) {
    message.error('删除失败')
  }
}

// 签名管理方法
function handleAddSignature() {
  currentSignature.value = null
  signatureFormVisible.value = true
}

function handleEditSignature(signature) {
  currentSignature.value = signature
  signatureFormVisible.value = true
}

async function handleSignatureSubmit(data) {
  try {
    if (data.id) {
      await signatureStore.updateSignature(data.id, {
        name: data.name,
        content: data.content,
      })
    } else {
      await signatureStore.addSignature(data)
    }
  } catch (error) {
    message.error('操作失败')
  }
}

async function handleSetDefaultSignature(signatureId) {
  try {
    await signatureStore.setDefaultSignature(signatureId)
    message.success('已设为默认签名')
  } catch (error) {
    message.error('设置失败')
  }
}

async function handleDeleteSignature(signatureId) {
  try {
    await signatureStore.deleteSignature(signatureId)
    message.success('签名已删除')
  } catch (error) {
    message.error('删除失败')
  }
}

// 工具方法
function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'span', 'div', 'a', 'img'],
    ALLOWED_ATTR: ['style', 'href', 'src', 'alt'],
  })
}
</script>

<style lang="scss" scoped>
.settings-page {
  height: 100%;
  background: white;
}

.settings-layout {
  height: 100%;
}

.settings-sidebar {
  border-right: 1px solid #F0F0F0;
}

.settings-menu {
  border-right: none;
  padding: 16px 8px;

  :deep(.ant-menu-item) {
    border-radius: 6px;
    margin-bottom: 4px;
  }
}

.settings-content {
  padding: 24px;
  overflow-y: auto;
}

.settings-panel {
  max-width: 800px;
}

.panel-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
}

.about-content {
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
}

.about-logo {
  margin-bottom: 24px;
}

.about-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.about-subtitle {
  font-size: 16px;
  color: #8C8C8C;
  margin-bottom: 8px;
}

.about-version {
  font-size: 14px;
  color: #BFBFBF;
}

.about-info {
  text-align: left;
  padding: 24px;
  background: #FAFAFA;
  border-radius: 8px;

  p {
    margin-bottom: 8px;
  }

  a {
    color: #1890FF;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.signature-preview {
  max-width: 400px;
  max-height: 60px;
  overflow: hidden;
  font-size: 12px;
  color: #8C8C8C;
  line-height: 1.5;

  :deep(p) {
    margin: 0;
  }

  :deep(img) {
    max-width: 100%;
    max-height: 40px;
  }
}
</style>
