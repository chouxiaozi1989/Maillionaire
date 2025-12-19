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
      // 使用 JSON 序列化/反序列化来去除 Vue 响应式代理
      let plainConfig
      try {
        plainConfig = JSON.parse(JSON.stringify(config))
      } catch (e) {
        // 如果 JSON 序列化失败，手动构建
        plainConfig = {
          enabled: config.enabled,
          protocol: config.protocol,
          host: config.host,
          port: config.port,
          auth: {
            enabled: config.auth?.enabled,
            username: config.auth?.username,
            password: config.auth?.password,
          },
        }
      }
      
      // 创建纯净的可序列化对象，填充默认值
      const serializableConfig = {
        enabled: plainConfig.enabled ?? DEFAULT_PROXY_CONFIG.enabled,
        protocol: plainConfig.protocol ?? DEFAULT_PROXY_CONFIG.protocol,
        host: plainConfig.host ?? DEFAULT_PROXY_CONFIG.host,
        port: plainConfig.port ?? DEFAULT_PROXY_CONFIG.port,
        auth: {
          enabled: plainConfig.auth?.enabled ?? DEFAULT_PROXY_CONFIG.auth.enabled,
          username: plainConfig.auth?.username ?? DEFAULT_PROXY_CONFIG.auth.username,
          password: plainConfig.auth?.password ?? DEFAULT_PROXY_CONFIG.auth.password,
        },
      }
      
      console.log('[ProxyConfig] Saving config:', serializableConfig)
      
      // 更新内部配置
      this.config = serializableConfig
      
      // 保存到 localStorage
      localStorage.setItem('proxy_config', JSON.stringify(serializableConfig))
      
      // 如果在 Electron 环境，同步到主进程
      if (window.electronAPI && window.electronAPI.setProxyConfig) {
        console.log('[ProxyConfig] Sending to Electron main process')
        // 确保传递纯净对象，避免 Vue 响应式对象导致的克隆错误
        await window.electronAPI.setProxyConfig(serializableConfig)
        console.log('[ProxyConfig] Successfully sent to main process')
      }
      
      return true
    } catch (error) {
      console.error('[ProxyConfig] Failed to save proxy config:', error)
      throw error  // 抛出错误以便上层捕获
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
    // 创建纯净的默认配置对象
    const defaultConfig = {
      enabled: DEFAULT_PROXY_CONFIG.enabled,
      protocol: DEFAULT_PROXY_CONFIG.protocol,
      host: DEFAULT_PROXY_CONFIG.host,
      port: DEFAULT_PROXY_CONFIG.port,
      auth: {
        enabled: DEFAULT_PROXY_CONFIG.auth.enabled,
        username: DEFAULT_PROXY_CONFIG.auth.username,
        password: DEFAULT_PROXY_CONFIG.auth.password,
      },
    }
    
    this.config = defaultConfig
    localStorage.removeItem('proxy_config')
    
    if (window.electronAPI && window.electronAPI.setProxyConfig) {
      await window.electronAPI.setProxyConfig(defaultConfig)
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
   * @param {object} configToTest - 可选，要测试的配置（如不传则使用当前保存的配置）
   */
  async testConnection(testUrl = 'https://www.google.com', configToTest = null) {
    try {
      // 使用传入的配置或当前保存的配置
      const testConfig = configToTest || this.config

      if (window.electronAPI && window.electronAPI.testProxy) {
        return await window.electronAPI.testProxy(testConfig, testUrl)
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

  /**
   * 获取账户的有效代理配置
   * 根据账户的 proxySettings.useIndependent 判断使用独立代理还是全局代理
   * @param {object} account - 账户对象
   * @returns {object|null} 有效的代理配置，如果不使用代理则返回 null
   */
  getEffectiveProxyConfig(account) {
    // 如果账户没有代理设置，使用全局配置
    if (!account || !account.proxySettings) {
      return this.config.enabled ? this.config : null
    }

    const accountProxy = account.proxySettings

    // 如果账户使用独立代理设置
    if (accountProxy.useIndependent) {
      // 独立设置：完全忽略全局代理
      // 如果账户开启了代理，使用账户的代理配置
      // 如果账户关闭了代理，返回 null（直接连接）
      if (accountProxy.enabled) {
        return {
          enabled: true,
          protocol: accountProxy.protocol || 'http',
          host: accountProxy.host || '127.0.0.1',
          port: accountProxy.port || 7890,
          auth: {
            enabled: accountProxy.auth?.enabled || false,
            username: accountProxy.auth?.username || '',
            password: accountProxy.auth?.password || '',
          },
        }
      } else {
        // 账户独立设置为不使用代理
        return null
      }
    }

    // 如果账户没有使用独立代理设置，使用全局配置
    return this.config.enabled ? this.config : null
  }
}

// 导出单例
export const proxyConfig = new ProxyConfig()

export default proxyConfig
