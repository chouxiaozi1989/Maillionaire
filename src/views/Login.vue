<template>
  <div class="login-page">
    <div class="login-container">
      <div class="logo-section">
        <div class="logo">
          <MailOutlined :style="{ fontSize: '48px', color: 'white' }" />
        </div>
        <h1 class="app-title">Maillionaire</h1>
        <p class="app-subtitle">专业的邮件收发客户端</p>
      </div>
      
      <div v-if="accounts.length > 0" class="account-list">
        <div
          v-for="account in accounts"
          :key="account.id"
          class="account-item"
        >
          <a-avatar :size="48" :style="{ backgroundColor: getAvatarColor(account.email) }" @click="handleLogin(account)">
            {{ getInitial(account.email) }}
          </a-avatar>
          <div class="account-info" @click="handleLogin(account)">
            <div class="account-name">{{ account.name || account.email }}</div>
            <div class="account-email">{{ account.email }}</div>
          </div>
          <div class="account-status" :class="{ connected: account.connected }"></div>
          <div class="account-actions">
            <a-button type="text" size="small" @click="handleEditAccount(account)">
              <template #icon>
                <EditOutlined />
              </template>
            </a-button>
            <a-popconfirm
              title="确定要删除这个账户吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="handleDeleteAccount(account.id)"
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
      
      <a-button
        type="dashed"
        size="large"
        block
        class="add-account-btn"
        @click="showAddAccount = true"
      >
        <template #icon>
          <PlusOutlined />
        </template>
        添加邮箱账户
      </a-button>

      <!-- 代理设置入口 -->
      <a-button
        type="text"
        size="small"
        class="proxy-settings-btn"
        @click="showProxySettings = true"
      >
        <template #icon>
          <GlobalOutlined />
        </template>
        网络代理设置
      </a-button>
      
      <div class="footer-text">
        {{ APP_VERSION.versionString }} | {{ APP_VERSION.copyright }}
      </div>
    </div>
    
    <!-- 添加账户弹窗 -->
    <a-modal
      v-model:open="showAddAccount"
      :title="editingAccount ? '编辑账户' : '添加邮箱账户'"
      :width="600"
      @ok="handleAddAccount"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        layout="vertical"
      >
        <a-form-item label="邮箱类型" name="type">
          <a-select v-model:value="formData.type" @change="handleTypeChange">
            <a-select-option value="gmail">Gmail</a-select-option>
            <a-select-option value="outlook">Outlook/Hotmail</a-select-option>
            <a-select-option value="qq">QQ邮箱</a-select-option>
            <a-select-option value="163">163邮箱</a-select-option>
            <a-select-option value="126">126邮箱</a-select-option>
          </a-select>
        </a-form-item>
        
        <a-form-item label="邮箱地址" name="email">
          <a-input v-model:value="formData.email" placeholder="example@email.com" />
        </a-form-item>
        
        <a-form-item v-if="!isOAuth2" label="授权码/密码" name="password">
          <a-input-password v-model:value="formData.password" placeholder="请输入授权码或密码" />
        </a-form-item>
        
        <a-alert
          v-if="formData.type === 'qq' || formData.type === '163' || formData.type === '126'"
          message="请使用授权码而非登录密码"
          type="warning"
          show-icon
          class="auth-code-alert"
        >
          <template #description>
            <div>
              <p><strong>获取授权码步骤：</strong></p>
              <ol style="margin: 8px 0; padding-left: 20px;">
                <li>登录邮箱网页版</li>
                <li>进入「设置」→「账户」</li>
                <li>找到「POP3/IMAP/SMTP服务」</li>
                <li>开启「IMAP/SMTP服务」</li>
                <li>生成授权码并保存（16位字符）</li>
                <li>在下方输入框中填写授权码</li>
              </ol>
              <p style="color: #ff4d4f; margin-bottom: 0;">注意：授权码不是邮箱登录密码！</p>
            </div>
          </template>
        </a-alert>
      </a-form>
    </a-modal>

    <!-- 代理设置弹窗 -->
    <a-modal
      v-model:open="showProxySettings"
      title="网络代理设置"
      :width="600"
      :footer="null"
    >
      <a-form layout="horizontal" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }">
        <a-form-item label="启用代理">
          <a-switch v-model:checked="proxySettings.enabled" />
          <span style="margin-left: 8px; color: #8C8C8C;">
            启用后所有网络请求将通过代理服务器
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
          <div style="margin-top: 4px; color: #8C8C8C; font-size: 12px;">
            💡 提示：推荐使用 HTTP 协议（HTTPS 可能遇到 TLS 证书问题）
          </div>
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
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { MailOutlined, PlusOutlined, EditOutlined, DeleteOutlined, GlobalOutlined } from '@ant-design/icons-vue'
import { useAccountStore } from '@/stores/account'
import { oauth2Service } from '@/services/oauth'
import APP_VERSION from '@/config/version'
import proxyConfig from '@/config/proxy'

const router = useRouter()
const accountStore = useAccountStore()

// 账户列表
const accounts = computed(() => accountStore.accounts)

// 添加账户弹窗
const showAddAccount = ref(false)
const editingAccount = ref(null)  // 正在编辑的账户
const formRef = ref(null)
const formData = reactive({
  type: 'gmail',
  email: '',
  password: '',
  name: '',
})

// 代理设置弹窗
const showProxySettings = ref(false)
const proxySettings = ref(proxyConfig.getConfig())
const testingProxy = ref(false)
const testUrl = ref('https://www.google.com')

// 邮箱配置
const emailConfigs = {
  gmail: {
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    oauth2: true,
  },
  outlook: {
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    oauth2: true,
  },
  qq: {
    imapHost: 'imap.qq.com',
    imapPort: 993,
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
  },
  '163': {
    imapHost: 'imap.163.com',
    imapPort: 993,
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
  },
  '126': {
    imapHost: 'imap.126.com',
    imapPort: 993,
    smtpHost: 'smtp.126.com',
    smtpPort: 465,
  },
}

// 是否使用OAuth2
const isOAuth2 = computed(() => {
  return formData.type === 'gmail' || formData.type === 'outlook'
})

// 表单验证规则
const rules = {
  type: [{ required: true, message: '请选择邮箱类型' }],
  email: [
    { required: true, message: '请输入邮箱地址' },
    { type: 'email', message: '请输入有效的邮箱地址' },
  ],
  password: [{ required: !isOAuth2.value, message: '请输入授权码或密码' }],
}

/**
 * 邮箱类型改变
 */
function handleTypeChange() {
  formData.password = ''
}

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
 * 登录
 */
async function handleLogin(account) {
  try {
    accountStore.switchAccount(account.id)
    message.success('登录成功')
    router.push('/main/inbox')
  } catch (error) {
    message.error('登录失败：' + error.message)
  }
}

/**
 * 添加账户
 */
async function handleAddAccount() {
  try {
    await formRef.value.validate()
    
    const config = emailConfigs[formData.type]
    let account
    let skipVerify = false  // 是否跳过验证
    
    // 如果是编辑模式
    if (editingAccount.value) {
      // 更新账户
      const updates = {
        name: formData.name || formData.email.split('@')[0],
      }
      
      // 如果修改了密码，更新密码
      if (!isOAuth2.value && formData.password) {
        updates.password = formData.password
        updates.connected = false  // 重置连接状态
      }
      
      await accountStore.updateAccount(editingAccount.value.id, updates)
      message.success('账户更新成功')
      
      // 关闭弹窗
      showAddAccount.value = false
      editingAccount.value = null
      
      // 重置表单
      formRef.value.resetFields()
      formData.type = 'gmail'
      formData.email = ''
      formData.password = ''
      formData.name = ''
      
      return
    }
    
    if (isOAuth2.value) {
      // OAuth2 认证流程
      message.loading('正在进行 OAuth2 认证...', 0)
      
      try {
        const result = await oauth2Service.authenticate(formData.type, formData.email)
        message.destroy()
        
        if (!result.success) {
          message.error('认证失败：' + result.error)
          return
        }
        
        account = {
          type: formData.type,
          email: formData.email,
          name: formData.name || formData.email.split('@')[0],
          ...config,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
          connected: true,
          oauth2: true,
        }
        
        // OAuth2 认证成功，跳过 IMAP/SMTP 验证
        // 因为 OAuth2 的 IMAP/SMTP 认证需要在 Electron 主进程中实现
        skipVerify = true
        
        // OAuth2 测试模式，跳过验证
        if (result.testMode) {
          account.testMode = true
          skipVerify = true
        }
        
        message.success('OAuth2 认证成功')
      } catch (error) {
        message.destroy()
        message.error('OAuth2 认证失败，请使用测试模式')
        
        // 测试模式：直接添加账户（用于开发测试）
        account = {
          type: formData.type,
          email: formData.email,
          name: formData.name || formData.email.split('@')[0],
          ...config,
          connected: false,
          oauth2: true,
          testMode: true,
        }
        skipVerify = true
      }
    } else {
      // IMAP/SMTP 认证
      account = {
        type: formData.type,
        email: formData.email,
        password: formData.password,
        name: formData.name || formData.email.split('@')[0],
        ...config,
        connected: false,
      }
    }
    
    // 添加账户并验证连接
    const loadingMsg = message.loading('正在验证账户连接...', 0)
    
    try {
      const newAccount = await accountStore.addAccountWithVerify(account, skipVerify)
      loadingMsg()
      
      // 检查验证结果
      if (!skipVerify && newAccount.verifyResult) {
        const { imap, smtp, errors } = newAccount.verifyResult
        
        if (imap && smtp) {
          message.success('账户添加成功，连接验证通过')
        } else {
          // 更详细的错误信息
          let errorDetails = []
          
          if (!imap) {
            errorDetails.push('IMAP连接失败')
            errorDetails.push('请检查：')
            errorDetails.push('1. 是否已在邮箱网页版开启IMAP服务')
            errorDetails.push('2. 是否使用授权码（非登录密码）')
            errorDetails.push('3. 授权码是否正确')
          }
          
          if (!smtp) {
            if (errorDetails.length > 0) errorDetails.push('')
            errorDetails.push('SMTP连接失败')
            errorDetails.push('请检查：')
            errorDetails.push('1. 是否已在邮箱网页版开启SMTP服务')
            errorDetails.push('2. 是否使用授权码（非登录密码）')
          }
          
          const errorMsg = errors.join('; ')
          
          // 使用 Modal 显示详细错误
          const confirmed = await new Promise((resolve) => {
            message.destroy()
            Modal.confirm({
              title: '连接验证失败',
              width: 500,
              content: h('div', [
                h('p', { style: 'color: #ff4d4f; margin-bottom: 12px; font-weight: 500;' }, `错误信息：${errorMsg}`),
                h('div', { style: 'margin: 12px 0; padding: 12px; background: #fafafa; border-radius: 4px;' }, 
                  errorDetails.map(detail => 
                    h('div', { 
                      style: detail.startsWith('IMAP') || detail.startsWith('SMTP') 
                        ? 'margin-top: 8px; font-weight: 500; color: #262626;' 
                        : 'margin-left: 16px; margin-top: 4px; color: #595959; font-size: 13px;'
                    }, detail)
                  )
                ),
                h('p', { style: 'color: #8c8c8c; margin-top: 12px; margin-bottom: 0;' }, '是否仍然添加此账户？您可以稍后在设置中修复连接问题。'),
              ]),
              okText: '仍然添加',
              cancelText: '取消',
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            })
          })
          
          if (!confirmed) {
            // 用户取消，移除已添加的账户
            await accountStore.deleteAccount(newAccount.id)
            return
          }
        }
      } else {
        message.success('账户添加成功')
      }
      
      // 关闭弹窗
      showAddAccount.value = false
      
      // 重置表单
      formRef.value.resetFields()
      formData.type = 'gmail'
      formData.email = ''
      formData.password = ''
      formData.name = ''
      
      // 自动登录新添加的账户
      await handleLogin(newAccount)
    } catch (error) {
      loadingMsg()
      throw error
    }
    
  } catch (error) {
    console.error('Add account failed:', error)
    message.error('添加账户失败：' + error.message)
  }
}

/**
 * 编辑账户
 */
function handleEditAccount(account) {
  editingAccount.value = account
  formData.type = account.type
  formData.email = account.email
  formData.name = account.name
  formData.password = ''  // 不显示密码
  showAddAccount.value = true
}

/**
 * 删除账户
 */
async function handleDeleteAccount(accountId) {
  try {
    await accountStore.deleteAccount(accountId)
    message.success('账户删除成功')
  } catch (error) {
    console.error('Delete account failed:', error)
    message.error('删除账户失败：' + error.message)
  }
}

// 代理设置方法
async function handleSaveProxySettings() {
  try {
    const success = await proxyConfig.saveConfig(proxySettings.value)
    if (success) {
      message.success('代理设置已保存')
      showProxySettings.value = false
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
  
  if (!testUrl.value || !testUrl.value.trim()) {
    message.warning('请输入测试 URL')
    return
  }
  
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

// 初始化：加载账户列表
onMounted(async () => {
  try {
    await accountStore.loadAccounts()
  } catch (error) {
    console.error('Failed to load accounts:', error)
  }
})
</script>

<style lang="scss" scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  background: white;
  border-radius: 16px;
  padding: 48px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 480px;
  width: 100%;
}

.logo-section {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #1890FF 0%, #096DD9 100%);
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.app-title {
  font-size: 32px;
  font-weight: 700;
  color: #262626;
  margin-bottom: 8px;
}

.app-subtitle {
  font-size: 14px;
  color: #8C8C8C;
}

.account-list {
  margin-bottom: 24px;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 2px solid #F0F0F0;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: var(--primary-color);
    background: #F0F7FF;
    
    .account-actions {
      opacity: 1;
    }
  }
}

.account-info {
  flex: 1;
  margin-left: 16px;
  cursor: pointer;
}

.account-name {
  font-size: 16px;
  font-weight: 500;
  color: #262626;
  margin-bottom: 4px;
}

.account-email {
  font-size: 14px;
  color: #8C8C8C;
}

.account-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #D9D9D9;
  margin-right: 8px;
  
  &.connected {
    background: var(--success-color);
  }
}

.account-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.add-account-btn {
  margin-bottom: 24px;
}

.proxy-settings-btn {
  margin-top: 16px;
  width: 100%;
  color: #8C8C8C;
  
  &:hover {
    color: var(--primary-color);
  }
}

.footer-text {
  text-align: center;
  font-size: 12px;
  color: #BFBFBF;
}

.auth-code-alert {
  margin-top: 12px;
  
  :deep(.ant-alert-description) {
    p {
      margin-bottom: 8px;
    }
    
    ol {
      margin: 8px 0;
      padding-left: 20px;
      
      li {
        margin-bottom: 4px;
        color: #595959;
      }
    }
  }
}
</style>
