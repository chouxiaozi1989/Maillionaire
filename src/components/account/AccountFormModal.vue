<template>
  <a-modal
    :open="visible"
    :title="isEditing ? '编辑账户' : '添加邮箱账户'"
    :width="600"
    @cancel="handleCancel"
    @ok="handleSubmit"
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
              <li>在上方输入框中填写授权码</li>
            </ol>
            <p style="color: #ff4d4f; margin-bottom: 0;">注意：授权码不是邮箱登录密码！</p>
          </div>
        </template>
      </a-alert>

      <a-divider />

      <!-- 代理设置 -->
      <h4 style="margin-bottom: 16px;">代理设置</h4>

      <a-form-item label="使用独立代理设置">
        <a-switch v-model:checked="formData.proxySettings.useIndependent" />
        <span style="margin-left: 8px; color: #8C8C8C;">
          开启后将忽略全局代理设置，使用此账户独立的代理配置
        </span>
      </a-form-item>

      <template v-if="formData.proxySettings.useIndependent">
        <a-alert
          message="独立代理说明"
          type="info"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #description>
            <p style="margin: 0;">此账户将完全忽略全局代理设置，按照下方配置进行连接。</p>
            <p style="margin: 4px 0 0 0;">如果关闭"启用代理"，则此账户将不使用任何代理直接连接。</p>
          </template>
        </a-alert>

        <a-form-item label="启用代理">
          <a-switch v-model:checked="formData.proxySettings.enabled" />
          <span style="margin-left: 8px; color: #8C8C8C;">
            {{ formData.proxySettings.enabled ? '此账户将通过代理连接' : '此账户将直接连接（不使用代理）' }}
          </span>
        </a-form-item>

        <template v-if="formData.proxySettings.enabled">
          <a-form-item label="代理协议">
            <a-select v-model:value="formData.proxySettings.protocol" style="width: 200px">
              <a-select-option value="http">HTTP</a-select-option>
              <a-select-option value="https">HTTPS</a-select-option>
              <a-select-option value="socks5">SOCKS5</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="服务器地址">
            <a-input
              v-model:value="formData.proxySettings.host"
              placeholder="127.0.0.1"
              style="width: 300px"
            />
          </a-form-item>

          <a-form-item label="端口">
            <a-input-number
              v-model:value="formData.proxySettings.port"
              :min="1"
              :max="65535"
              placeholder="7890"
              style="width: 200px"
            />
          </a-form-item>

          <a-form-item label="需要认证">
            <a-switch v-model:checked="formData.proxySettings.auth.enabled" />
          </a-form-item>

          <template v-if="formData.proxySettings.auth.enabled">
            <a-form-item label="用户名">
              <a-input
                v-model:value="formData.proxySettings.auth.username"
                placeholder="输入用户名"
                style="width: 300px"
              />
            </a-form-item>

            <a-form-item label="密码">
              <a-input-password
                v-model:value="formData.proxySettings.auth.password"
                placeholder="输入密码"
                style="width: 300px"
              />
            </a-form-item>
          </template>
        </template>
      </template>

      <a-alert
        v-if="!formData.proxySettings.useIndependent"
        message="当前使用全局代理设置"
        type="info"
        show-icon
        style="margin-top: 8px"
      >
        <template #description>
          此账户将使用系统设置中的全局代理配置。如需为此账户单独配置代理，请开启"使用独立代理设置"。
        </template>
      </a-alert>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch, h } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useAccountStore } from '@/stores/account'
import { oauth2Service } from '@/services/oauth'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  account: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const accountStore = useAccountStore()
const formRef = ref(null)
const formData = reactive({
  type: 'gmail',
  email: '',
  password: '',
  name: '',
  proxySettings: {
    useIndependent: false,  // 是否使用独立代理设置
    enabled: false,         // 是否启用代理（仅在 useIndependent 为 true 时有效）
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890,
    auth: {
      enabled: false,
      username: '',
      password: '',
    },
  },
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

const isEditing = computed(() => !!props.account)
const isOAuth2 = computed(() => {
  return formData.type === 'gmail' || formData.type === 'outlook'
})

const rules = {
  type: [{ required: true, message: '请选择邮箱类型' }],
  email: [
    { required: true, message: '请输入邮箱地址' },
    { type: 'email', message: '请输入有效的邮箱地址' },
  ],
  password: [{ required: !isOAuth2.value, message: '请输入授权码或密码' }],
}

// 监听 props.account 变化，更新表单数据
watch(() => props.account, (newVal) => {
  if (newVal) {
    formData.type = newVal.type
    formData.email = newVal.email
    formData.name = newVal.name
    formData.password = ''
    // 加载代理设置
    if (newVal.proxySettings) {
      formData.proxySettings = {
        useIndependent: newVal.proxySettings.useIndependent || false,
        enabled: newVal.proxySettings.enabled || false,
        protocol: newVal.proxySettings.protocol || 'http',
        host: newVal.proxySettings.host || '127.0.0.1',
        port: newVal.proxySettings.port || 7890,
        auth: {
          enabled: newVal.proxySettings.auth?.enabled || false,
          username: newVal.proxySettings.auth?.username || '',
          password: newVal.proxySettings.auth?.password || '',
        },
      }
    } else {
      formData.proxySettings = {
        useIndependent: false,
        enabled: false,
        protocol: 'http',
        host: '127.0.0.1',
        port: 7890,
        auth: {
          enabled: false,
          username: '',
          password: '',
        },
      }
    }
  }
}, { immediate: true })

// 监听 visible 变化，重置表单
watch(() => props.visible, (newVal) => {
  if (newVal && !props.account) {
    resetForm()
  }
})

function handleTypeChange() {
  formData.password = ''
}

function handleCancel() {
  emit('update:visible', false)
}

function resetForm() {
  formData.type = 'gmail'
  formData.email = ''
  formData.password = ''
  formData.name = ''
  formData.proxySettings = {
    useIndependent: false,
    enabled: false,
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890,
    auth: {
      enabled: false,
      username: '',
      password: '',
    },
  }
  formRef.value?.resetFields()
}

async function handleSubmit() {
  try {
    await formRef.value.validate()
    
    const config = emailConfigs[formData.type]
    let account
    let skipVerify = false
    
    // 如果是编辑模式
    if (isEditing.value) {
      const updates = {
        name: formData.name || formData.email.split('@')[0],
        proxySettings: JSON.parse(JSON.stringify(formData.proxySettings)),
      }
      
      if (!isOAuth2.value && formData.password) {
        updates.password = formData.password
        updates.connected = false
      }
      
      await accountStore.updateAccount(props.account.id, updates)
      message.success('账户更新成功')
      emit('update:visible', false)
      emit('success')
      return
    }
    
    if (isOAuth2.value) {
      // OAuth2 认证流程
      message.loading('正在进行 OAuth2 认证...', 0)
      
      try {
        // 传递代理设置给 OAuth2 认证流程
        const result = await oauth2Service.authenticate(
          formData.type,
          formData.email,
          formData.proxySettings
        )
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
          proxySettings: JSON.parse(JSON.stringify(formData.proxySettings)),
        }
        
        skipVerify = true
        
        if (result.testMode) {
          account.testMode = true
          skipVerify = true
        }
        
        message.success('OAuth2 认证成功')
      } catch (error) {
        message.destroy()
        message.error('OAuth2 认证失败，请使用测试模式')
        
        account = {
          type: formData.type,
          email: formData.email,
          name: formData.name || formData.email.split('@')[0],
          ...config,
          connected: false,
          oauth2: true,
          testMode: true,
          proxySettings: JSON.parse(JSON.stringify(formData.proxySettings)),
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
        proxySettings: JSON.parse(JSON.stringify(formData.proxySettings)),
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
            await accountStore.deleteAccount(newAccount.id)
            return
          }
        }
      } else {
        message.success('账户添加成功')
      }
      
      emit('update:visible', false)
      emit('success', newAccount)
      resetForm()
    } catch (error) {
      loadingMsg()
      throw error
    }
    
  } catch (error) {
    console.error('Add account failed:', error)
    message.error('添加账户失败：' + error.message)
  }
}
</script>

<style lang="scss" scoped>
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
