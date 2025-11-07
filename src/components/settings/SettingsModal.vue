<template>
  <a-modal
    :open="visible"
    title="系统设置"
    :width="900"
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

        <!-- 代理设置 -->
        <div v-if="selectedMenu[0] === 'proxy'" class="settings-panel">
          <h3 class="panel-title">代理设置</h3>

          <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
            <a-form-item label="启用代理">
              <a-switch v-model:checked="proxySettings.enabled" />
              <span style="margin-left: 8px; color: #8C8C8C; font-size: 12px;">
                所有网络连接通过代理
              </span>
            </a-form-item>

            <a-form-item label="代理协议">
              <a-select 
                v-model:value="proxySettings.protocol" 
                style="width: 180px"
                :disabled="!proxySettings.enabled"
              >
                <a-select-option value="socks5">SOCKS5</a-select-option>
                <a-select-option value="http">HTTP</a-select-option>
                <a-select-option value="https">HTTPS</a-select-option>
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

            <a-form-item label="认证">
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
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  SettingOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  MailOutlined,
  GithubOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible'])

// 状态
const selectedMenu = ref(['general'])
const testingProxy = ref(false)

// 通用设置
const settings = ref({
  theme: 'light',
  language: 'zh-CN',
  pageSize: 50,
  fetchMailLimit: 50,  // 每次拉取邮件数量
  autoSync: true,
  syncInterval: 15,
})

// 代理设置
const proxySettings = ref({
  enabled: false,
  protocol: 'socks5',
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
    // 保存到 appStore 和 localStorage
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

    const result = await window.electronAPI.testProxy(proxySettings.value, 'https://www.google.com')
    
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

    await window.electronAPI.setProxyConfig(proxySettings.value)
    message.success('代理设置已保存')
  } catch (error) {
    message.error('保存失败：' + error.message)
  }
}

/**
 * 关闭弹窗
 */
function handleClose() {
  emit('update:visible', false)
}

// 监听弹窗打开，加载设置
watch(() => props.visible, (visible) => {
  if (visible) {
    loadSettings()
  }
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
