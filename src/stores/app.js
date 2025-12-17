import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 应用全局状态管理
 */
export const useAppStore = defineStore('app', () => {
  // 应用数据路径
  const appDataPath = ref('')
  
  // 加载状态
  const loading = ref(false)
  
  // 侧边栏折叠状态
  const sidebarCollapsed = ref(false)
  
  // 主题模式
  const theme = ref('light')

  // 应用设置
  const settings = ref({
    pageSize: 50,
    fetchMailLimit: 50,  // 每次拉取邮件数量
    autoSync: true,
    syncInterval: 15,
    syncDeleteToServer: true,  // 删除邮件时是否同步到服务器
  })

  /**
   * 初始化应用
   */
  async function init() {
    try {
      // 获取应用数据路径
      if (window.electronAPI) {
        appDataPath.value = await window.electronAPI.getAppPath()
      } else {
        // 浏览器环境使用localStorage
        appDataPath.value = 'localStorage'
      }

      // 加载主题设置
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme) {
        theme.value = savedTheme
      }

      // 加载应用设置
      const savedSettings = localStorage.getItem('appSettings')
      if (savedSettings) {
        settings.value = { ...settings.value, ...JSON.parse(savedSettings) }
      }

      console.log('App initialized, data path:', appDataPath.value)
    } catch (error) {
      console.error('Failed to initialize app:', error)
    }
  }

  /**
   * 保存应用设置
   */
  function saveSettings(newSettings) {
    settings.value = { ...settings.value, ...newSettings }
    localStorage.setItem('appSettings', JSON.stringify(settings.value))
    console.log('[App] Settings saved:', settings.value)
  }
  
  /**
   * 切换侧边栏
   */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
  
  /**
   * 切换主题
   */
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    localStorage.setItem('theme', theme.value)
  }
  
  /**
   * 显示加载状态
   */
  function showLoading() {
    loading.value = true
  }
  
  /**
   * 隐藏加载状态
   */
  function hideLoading() {
    loading.value = false
  }
  
  return {
    appDataPath,
    loading,
    sidebarCollapsed,
    theme,
    settings,
    init,
    saveSettings,
    toggleSidebar,
    toggleTheme,
    showLoading,
    hideLoading,
  }
})
