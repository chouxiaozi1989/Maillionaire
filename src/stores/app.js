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
      
      console.log('App initialized, data path:', appDataPath.value)
    } catch (error) {
      console.error('Failed to initialize app:', error)
    }
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
    init,
    toggleSidebar,
    toggleTheme,
    showLoading,
    hideLoading,
  }
})
