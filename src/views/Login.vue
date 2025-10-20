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
          @click="handleLogin(account)"
        >
          <a-avatar :size="48" :style="{ backgroundColor: getAvatarColor(account.email) }">
            {{ getInitial(account.email) }}
          </a-avatar>
          <div class="account-info">
            <div class="account-name">{{ account.name || account.email }}</div>
            <div class="account-email">{{ account.email }}</div>
          </div>
          <div class="account-status" :class="{ connected: account.connected }"></div>
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
      
      <div class="footer-text">
        Version 1.0.0 | © 2025 Maillionaire
      </div>
    </div>
    
    <!-- 添加账户弹窗 -->
    <a-modal
      v-model:open="showAddAccount"
      title="添加邮箱账户"
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
          description="授权码可在邮箱设置中生成，用于第三方客户端登录"
          type="info"
          show-icon
        />
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { MailOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useAccountStore } from '@/stores/account'
import { oauth2Service } from '@/services/oauth'

const router = useRouter()
const accountStore = useAccountStore()

// 账户列表
const accounts = computed(() => accountStore.accounts)

// 添加账户弹窗
const showAddAccount = ref(false)
const formRef = ref(null)
const formData = reactive({
  type: 'gmail',
  email: '',
  password: '',
  name: '',
})

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
          const errorMsg = errors.join('; ')
          message.warning(`账户已添加，但连接验证失败: ${errorMsg}`)
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
  }
}

.account-info {
  flex: 1;
  margin-left: 16px;
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
  
  &.connected {
    background: var(--success-color);
  }
}

.add-account-btn {
  margin-bottom: 24px;
}

.footer-text {
  text-align: center;
  font-size: 12px;
  color: #BFBFBF;
}
</style>
