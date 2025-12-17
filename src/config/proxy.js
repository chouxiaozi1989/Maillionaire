/**
 * 代理配置管理
 */

// 默认代理配置
export const DEFAULT_PROXY_CONFIG = {
  enabled: false,
  protocol: 'http',  // http, https
  host: '127.0.0.1',
  port: 7890,
  auth: {
    enabled: false,
    username: '',
    password: '',
  },
}

/**
 * 代理配置类
 */
class ProxyConfig {
  constructor() {
    this.config = { ...DEFAULT_PROXY_CONFIG }
    this.loadConfig()
  }

  /**
   * 加载代理配置
   */
  loadConfig() {
    try {
      const saved = localStorage.getItem('proxy_config')
      if (saved) {
        this.config = {
          ...DEFAULT_PROXY_CONFIG,
          ...JSON.parse(saved),
        }
      }
    } catch (error) {
      console.error('Failed to load proxy config:', error)
    }
  }

  /**
   * 保存代理配置
   */
  async saveConfig(config) {
    try {
      // 深拷贝配置，确保没有循环引用
      this.config = {
        enabled: config.enabled ?? DEFAULT_PROXY_CONFIG.enabled,
        protocol: config.protocol ?? DEFAULT_PROXY_CONFIG.protocol,
        host: config.host ?? DEFAULT_PROXY_CONFIG.host,
        port: config.port ?? DEFAULT_PROXY_CONFIG.port,
        auth: {
          enabled: config.auth?.enabled ?? DEFAULT_PROXY_CONFIG.auth.enabled,
          username: config.auth?.username ?? DEFAULT_PROXY_CONFIG.auth.username,
          password: config.auth?.password ?? DEFAULT_PROXY_CONFIG.auth.password,
        },
      }
      
      // 保存到 localStorage
      localStorage.setItem('proxy_config', JSON.stringify(this.config))
      
      // 如果在 Electron 环境，同步到主进程
      if (window.electronAPI && window.electronAPI.setProxyConfig) {
        await window.electronAPI.setProxyConfig(this.config)
      }
      
      return true
    } catch (error) {
      console.error('Failed to save proxy config:', error)
      return false
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config }
  }

  /**
   * 重置为默认配置
   */
  async resetConfig() {
    this.config = { ...DEFAULT_PROXY_CONFIG }
    localStorage.removeItem('proxy_config')
    
    if (window.electronAPI && window.electronAPI.setProxyConfig) {
      await window.electronAPI.setProxyConfig(this.config)
    }
  }

  /**
   * 获取代理 URL（用于 axios 等）
   */
  getProxyUrl() {
    if (!this.config.enabled) {
      return null
    }

    const { protocol, host, port, auth } = this.config

    if (auth.enabled && auth.username) {
      return `${protocol}://${auth.username}:${auth.password}@${host}:${port}`
    }

    return `${protocol}://${host}:${port}`
  }

  /**
   * 获取 Electron 代理配置
   */
  getElectronProxyConfig() {
    if (!this.config.enabled) {
      return null
    }

    const { protocol, host, port } = this.config
    
    // Electron 代理规则格式
    return {
      proxyRules: `${protocol}://${host}:${port}`,
      proxyBypassRules: 'localhost,127.0.0.1',
    }
  }

  /**
   * 测试代理连接
   * @param {string} testUrl - 测试 URL，默认为 https://www.google.com
   */
  async testConnection(testUrl = 'https://www.google.com') {
    try {
      if (window.electronAPI && window.electronAPI.testProxy) {
        return await window.electronAPI.testProxy(this.config, testUrl)
      }
      
      // 浏览器环境简单测试
      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
      })
      return { success: true, message: '连接成功' }
    } catch (error) {
      return { 
        success: false, 
        message: error.message || '连接失败' 
      }
    }
  }
}

// 导出单例
export const proxyConfig = new ProxyConfig()

export default proxyConfig
