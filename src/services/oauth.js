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
    scope: 'https://mail.google.com/',
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
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
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
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
   * @returns {Promise<Object>} 令牌信息
   */
  async exchangeToken(provider, code) {
    const config = provider === 'gmail' ? this.gmailConfig : this.outlookConfig

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    })

    try {
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
   * @returns {Promise<Object>} 新的令牌信息
   */
  async refreshToken(provider, refreshToken) {
    const config = provider === 'gmail' ? this.gmailConfig : this.outlookConfig

    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    try {
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

        const authWindow = window.open(
          authUrl,
          'OAuth2 Authorization',
          `width=${width},height=${height},left=${left},top=${top}`
        )

        // 监听回调
        const checkInterval = setInterval(() => {
          try {
            if (authWindow.closed) {
              clearInterval(checkInterval)
              reject(new Error('Authorization window closed'))
              return
            }

            const url = new URL(authWindow.location.href)
            if (url.origin === window.location.origin && url.pathname === '/oauth/callback') {
              const code = url.searchParams.get('code')
              const returnedState = url.searchParams.get('state')

              authWindow.close()
              clearInterval(checkInterval)

              if (this.validateState(returnedState, email)) {
                resolve(code)
              } else {
                reject(new Error('Invalid state parameter'))
              }
            }
          } catch (e) {
            // 跨域错误，窗口还在授权页面
          }
        }, 500)
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
   * @returns {Promise<Object>} 认证结果
   */
  async authenticate(provider, email) {
    try {
      // 测试模式：直接返回模拟数据
      if (this.isTestMode()) {
        console.warn('OAuth2 Test Mode: Using mock authentication')
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

      // 1. 打开授权窗口获取授权码
      const code = await this.openAuthWindow(provider, email)

      // 2. 使用授权码交换访问令牌
      const tokens = await this.exchangeToken(provider, code)

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
   * 检查是否为测试模式
   * 如果没有配置 client ID，则自动启用测试模式
   */
  isTestMode() {
    return this.gmailConfig.clientId.startsWith('YOUR_') || 
           this.outlookConfig.clientId.startsWith('YOUR_')
  }
}

export const oauth2Service = new OAuth2Service()
