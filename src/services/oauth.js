/**
 * OAuth2 认证服务
 * 支持 Gmail 和 Outlook 的 OAuth2 认证
 */

class OAuth2Service {
  /**
   * Gmail OAuth2 配置
   */
  gmailConfig = {
    clientId: import.meta.env.VITE_GMAIL_CLIENT_ID || 'YOUR_GMAIL_CLIENT_ID',
    clientSecret: import.meta.env.VITE_GMAIL_CLIENT_SECRET || 'YOUR_GMAIL_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    // 添加 Gmail API scope
    scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels',
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback',
  }

  /**
   * Outlook OAuth2 配置
   */
  outlookConfig = {
    clientId: import.meta.env.VITE_OUTLOOK_CLIENT_ID || 'YOUR_OUTLOOK_CLIENT_ID',
    clientSecret: import.meta.env.VITE_OUTLOOK_CLIENT_SECRET || 'YOUR_OUTLOOK_CLIENT_SECRET',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access',
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth/callback',
  }

  /**
   * 获取授权 URL
   * @param {string} provider - 提供商 ('gmail' 或 'outlook')
   * @param {string} email - 邮箱地址
   * @returns {string} 授权 URL
   */
  getAuthUrl(provider, email) {
    const config = provider === 'gmail' ? this.gmailConfig : this.outlookConfig
    const state = this.generateState(email)

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope,
      state: state,
      access_type: 'offline',
      prompt: 'consent',
    })

    if (provider === 'gmail') {
      params.append('login_hint', email)
    }

    return `${config.authUrl}?${params.toString()}`
  }

  /**
   * 生成 state 参数（防止 CSRF 攻击）
   */
  generateState(email) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    return btoa(`${email}:${timestamp}:${random}`)
  }

  /**
   * 验证 state 参数
   */
  validateState(state, email) {
    try {
      const decoded = atob(state)
      const [stateEmail, timestamp] = decoded.split(':')
      
      // 验证邮箱和时间戳（5分钟内有效）
      const isValid = stateEmail === email && 
                     (Date.now() - parseInt(timestamp)) < 5 * 60 * 1000
      
      return isValid
    } catch (error) {
      return false
    }
  }

  /**
   * 使用授权码交换访问令牌
   * @param {string} provider - 提供商
   * @param {string} code - 授权码
   * @param {Object} proxySettings - 代理设置（可选）
   * @returns {Promise<Object>} 令牌信息
   */
  async exchangeToken(provider, code, proxySettings = null) {
    const config = provider === 'gmail' ? this.gmailConfig : this.outlookConfig

    // 在 Electron 环境中使用 IPC 调用（支持代理）
    if (window.electronAPI && window.electronAPI.oauth2ExchangeToken) {
      try {
        console.log('[OAuth2] Exchanging token via Electron IPC (with proxy support)')
        
        // 如果提供了代理设置，先应用代理
        if (proxySettings && proxySettings.enabled) {
          console.log('[OAuth2] Applying proxy settings:', proxySettings.host + ':' + proxySettings.port)
          // 确保代理设置是可序列化的纯对象
          const serializableProxy = {
            enabled: proxySettings.enabled,
            protocol: proxySettings.protocol,
            host: proxySettings.host,
            port: proxySettings.port,
            auth: {
              enabled: proxySettings.auth?.enabled || false,
              username: proxySettings.auth?.username || '',
              password: proxySettings.auth?.password || ''
            }
          }
          await window.electronAPI.setProxyConfig(serializableProxy)
        }
        
        return await window.electronAPI.oauth2ExchangeToken(provider, code, config)
      } catch (error) {
        console.error('[OAuth2] Electron token exchange failed:', error)
        throw error
      }
    }

    // 浏览器环境：使用 fetch（注意：不支持代理）
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    })

    try {
      console.log('[OAuth2] Exchanging token via fetch (browser mode, no proxy)')
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        throw new Error('Failed to exchange token')
      }

      const data = await response.json()
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        expiresAt: Date.now() + data.expires_in * 1000,
      }
    } catch (error) {
      console.error('Token exchange failed:', error)
      throw error
    }
  }

  /**
   * 刷新访问令牌
   * @param {string} provider - 提供商
   * @param {string} refreshToken - 刷新令牌
   * @param {Object} proxySettings - 代理设置（可选）
   * @returns {Promise<Object>} 新的令牌信息
   */
  async refreshToken(provider, refreshToken, proxySettings = null) {
    const config = provider === 'gmail' ? this.gmailConfig : this.outlookConfig

    // 在 Electron 环境中使用 IPC 调用（支持代理）
    if (window.electronAPI && window.electronAPI.oauth2RefreshToken) {
      try {
        console.log('[OAuth2] Refreshing token via Electron IPC (with proxy support)')
        
        // 如果提供了代理设置，先应用代理
        if (proxySettings && proxySettings.enabled) {
          console.log('[OAuth2] Applying proxy settings:', proxySettings.host + ':' + proxySettings.port)
          // 确保代理设置是可序列化的纯对象
          const serializableProxy = {
            enabled: proxySettings.enabled,
            protocol: proxySettings.protocol,
            host: proxySettings.host,
            port: proxySettings.port,
            auth: {
              enabled: proxySettings.auth?.enabled || false,
              username: proxySettings.auth?.username || '',
              password: proxySettings.auth?.password || ''
            }
          }
          await window.electronAPI.setProxyConfig(serializableProxy)
        }
        
        return await window.electronAPI.oauth2RefreshToken(provider, refreshToken, config)
      } catch (error) {
        console.error('[OAuth2] Electron token refresh failed:', error)
        throw error
      }
    }

    // 浏览器环境：使用 fetch（注意：不支持代理）
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    try {
      console.log('[OAuth2] Refreshing token via fetch (browser mode, no proxy)')
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (!response.ok) {
        throw new Error('Failed to refresh token')
      }

      const data = await response.json()
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        expiresAt: Date.now() + data.expires_in * 1000,
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      throw error
    }
  }

  /**
   * 在 Electron 中打开 OAuth2 授权窗口
   * @param {string} provider - 提供商
   * @param {string} email - 邮箱地址
   * @returns {Promise<string>} 授权码
   */
  async openAuthWindow(provider, email) {
    const authUrl = this.getAuthUrl(provider, email)
    const state = this.generateState(email)

    return new Promise((resolve, reject) => {
      // 在浏览器环境中，打开新窗口
      if (typeof window !== 'undefined' && !window.electron) {
        const width = 600
        const height = 700
        const left = (window.screen.width - width) / 2
        const top = (window.screen.height - height) / 2

        console.log('[OAuth2] Opening auth window:', authUrl)

        const authWindow = window.open(
          authUrl,
          'OAuth2 Authorization',
          `width=${width},height=${height},left=${left},top=${top},popup=yes,noopener=no`
        )

        if (!authWindow) {
          reject(new Error('无法打开授权窗口，请检查浏览器弹窗设置'))
          return
        }

        // 监听 postMessage 事件（由 OAuthCallback 组件发送）
        const messageHandler = (event) => {
          // 验证消息来源（安全检查）
          if (event.origin !== window.location.origin) {
            console.warn('[OAuth2] Received message from unknown origin:', event.origin)
            return
          }

          // 检查是否是 OAuth2 回调消息
          if (event.data && event.data.type === 'oauth2-callback') {
            console.log('[OAuth2] Received callback message:', { 
              hasCode: !!event.data.code,
              hasError: !!event.data.error 
            })

            // 移除事件监听
            window.removeEventListener('message', messageHandler)
            clearInterval(checkInterval)
            clearTimeout(timeoutId)

            const { code, state: returnedState, error, error_description } = event.data

            // 关闭授权窗口
            try {
              if (authWindow && !authWindow.closed) {
                authWindow.close()
              }
            } catch (e) {
              // 忽略关闭窗口错误
              console.warn('[OAuth2] Failed to close auth window:', e)
            }

            // 处理错误
            if (error) {
              reject(new Error(error_description || error))
              return
            }

            // 检查授权码
            if (!code) {
              reject(new Error('未收到授权码'))
              return
            }

            // 验证 state
            if (this.validateState(returnedState, email)) {
              console.log('[OAuth2] Authorization successful, code received')
              resolve(code)
            } else {
              reject(new Error('State 验证失败，可能存在安全风险'))
            }
          }
        }

        // 添加消息监听
        window.addEventListener('message', messageHandler)

        // 定期检查窗口是否被用户关闭（后备方案）
        const checkInterval = setInterval(() => {
          try {
            // 尝试检查窗口状态（可能因 COOP 失败）
            if (authWindow.closed) {
              console.log('[OAuth2] Auth window was closed by user')
              window.removeEventListener('message', messageHandler)
              clearInterval(checkInterval)
              clearTimeout(timeoutId)
              reject(new Error('用户关闭了授权窗口'))
            }
          } catch (e) {
            // COOP 错误，忽略
          }
        }, 1000)

        // 超时处理（5分钟）
        const timeoutId = setTimeout(() => {
          console.log('[OAuth2] Auth timeout after 5 minutes')
          window.removeEventListener('message', messageHandler)
          clearInterval(checkInterval)
          try {
            if (authWindow && !authWindow.closed) {
              authWindow.close()
            }
          } catch (e) {
            // 忽略关闭错误
          }
          reject(new Error('授权超时，请重试'))
        }, 5 * 60 * 1000)
      } 
      // 在 Electron 环境中
      else if (window.electron) {
        // TODO: 使用 Electron BrowserWindow 打开授权窗口
        reject(new Error('Electron OAuth2 not implemented yet'))
      }
      else {
        reject(new Error('Unsupported environment'))
      }
    })
  }

  /**
   * 完整的 OAuth2 认证流程
   * @param {string} provider - 提供商 ('gmail' 或 'outlook')
   * @param {string} email - 邮箱地址
   * @param {Object} proxySettings - 代理设置（可选）
   * @returns {Promise<Object>} 认证结果
   */
  async authenticate(provider, email, proxySettings = null) {
    try {
      // 检查是否配置了 OAuth2 凭证
      const config = provider === 'gmail' ? this.gmailConfig : this.outlookConfig
      const isConfigured = !config.clientId.startsWith('YOUR_')

      // 测试模式：当 OAuth2 未配置时，返回模拟数据
      if (!isConfigured) {
        console.warn(`OAuth2 Test Mode: ${provider} credentials not configured, using mock authentication`)
        return {
          success: true,
          email: email,
          provider: provider,
          accessToken: 'test_access_token_' + Date.now(),
          refreshToken: 'test_refresh_token_' + Date.now(),
          expiresAt: Date.now() + 3600 * 1000,
          testMode: true,
        }
      }

      // 生产环境：执行真实的 OAuth2 认证流程
      console.log(`OAuth2 Production Mode: Starting ${provider} authentication for ${email}`)
      
      // 如果提供了代理设置，先应用代理（用于打开授权窗口）
      if (proxySettings && proxySettings.enabled && window.electronAPI && window.electronAPI.setProxyConfig) {
        console.log('[OAuth2] Applying proxy settings for authorization:', proxySettings.host + ':' + proxySettings.port)
        // 确保代理设置是可序列化的纯对象
        const serializableProxy = {
          enabled: proxySettings.enabled,
          protocol: proxySettings.protocol,
          host: proxySettings.host,
          port: proxySettings.port,
          auth: {
            enabled: proxySettings.auth?.enabled || false,
            username: proxySettings.auth?.username || '',
            password: proxySettings.auth?.password || ''
          }
        }
        await window.electronAPI.setProxyConfig(serializableProxy)
      }

      // 1. 打开授权窗口获取授权码
      const code = await this.openAuthWindow(provider, email)

      // 2. 使用授权码交换访问令牌（传递代理设置）
      const tokens = await this.exchangeToken(provider, code, proxySettings)

      return {
        success: true,
        email: email,
        provider: provider,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      }
    } catch (error) {
      console.error('OAuth2 authentication failed:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * 检查 OAuth2 凭证是否已配置
   * @param {string} provider - 提供商 ('gmail' 或 'outlook')
   * @returns {boolean} 是否已配置
   */
  isConfigured(provider) {
    const config = provider === 'gmail' ? this.gmailConfig : this.outlookConfig
    return !config.clientId.startsWith('YOUR_')
  }
}

export const oauth2Service = new OAuth2Service()
