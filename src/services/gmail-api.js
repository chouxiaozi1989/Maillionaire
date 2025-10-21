/**
 * Gmail API 服务
 * 使用 Gmail API v1 获取邮件和标签
 */

class GmailApiService {
  /**
   * API 基础 URL
   */
  baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me'

  /**
   * 获取用户标签列表（文件夹）
   * @param {string} accessToken - OAuth2 访问令牌
   * @returns {Promise<Array>} 标签列表
   */
  async getLabels(accessToken) {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/labels`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      const { labels } = response

      // 转换为应用格式
      return labels.map(label => ({
        id: label.id,
        name: label.name,
        type: label.type, // system 或 user
        messageTotal: label.messagesTotal || 0,
        messageUnread: label.messagesUnread || 0,
        threadsTotal: label.threadsTotal || 0,
        threadsUnread: label.threadsUnread || 0,
      }))
    } catch (error) {
      console.error('[Gmail API] Failed to get labels:', error)
      throw error
    }
  }

  /**
   * 获取邮件列表
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {Object} options - 选项
   * @param {string} options.labelIds - 标签 ID 列表（逗号分隔）
   * @param {number} options.maxResults - 最大结果数
   * @param {string} options.q - 搜索查询
   * @returns {Promise<Array>} 邮件列表
   */
  async listMessages(accessToken, options = {}) {
    try {
      const params = new URLSearchParams()
      
      if (options.labelIds) {
        options.labelIds.split(',').forEach(id => {
          params.append('labelIds', id.trim())
        })
      }
      
      if (options.maxResults) {
        params.append('maxResults', options.maxResults.toString())
      }
      
      if (options.q) {
        params.append('q', options.q)
      }

      const url = `${this.baseUrl}/messages?${params.toString()}`
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      return response.messages || []
    } catch (error) {
      console.error('[Gmail API] Failed to list messages:', error)
      throw error
    }
  }

  /**
   * 获取邮件详情
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @param {string} format - 格式 (full, metadata, minimal, raw)
   * @returns {Promise<Object>} 邮件详情
   */
  async getMessage(accessToken, messageId, format = 'full') {
    try {
      const url = `${this.baseUrl}/messages/${messageId}?format=${format}`
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      return response
    } catch (error) {
      console.error('[Gmail API] Failed to get message:', error)
      throw error
    }
  }

  /**
   * 发送邮件
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} rawMessage - RFC 2822 格式的邮件内容（Base64 编码）
   * @returns {Promise<Object>} 发送结果
   */
  async sendMessage(accessToken, rawMessage) {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/messages/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: rawMessage,
        }),
      })

      return response
    } catch (error) {
      console.error('[Gmail API] Failed to send message:', error)
      throw error
    }
  }

  /**
   * 创建标签
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} name - 标签名称
   * @returns {Promise<Object>} 创建的标签
   */
  async createLabel(accessToken, name) {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        }),
      })

      return response
    } catch (error) {
      console.error('[Gmail API] Failed to create label:', error)
      throw error
    }
  }

  /**
   * 删除标签
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} labelId - 标签 ID
   * @returns {Promise<void>}
   */
  async deleteLabel(accessToken, labelId) {
    try {
      await this.makeRequest(`${this.baseUrl}/labels/${labelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      console.error('[Gmail API] Failed to delete label:', error)
      throw error
    }
  }

  /**
   * 发起 HTTP 请求
   * @param {string} url - 请求 URL
   * @param {Object} options - Fetch 选项
   * @returns {Promise<Object>} 响应数据
   */
  async makeRequest(url, options) {
    try {
      // 如果在 Electron 环境中，使用 IPC 调用（支持代理）
      if (window.electronAPI && window.electronAPI.gmailApiRequest) {
        console.log('[Gmail API] Using Electron IPC (with proxy support)')
        return await window.electronAPI.gmailApiRequest(url, options)
      }

      // 浏览器环境：直接使用 fetch
      console.log('[Gmail API] Using fetch (browser mode)')
      const response = await fetch(url, options)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[Gmail API] Request failed:', error)
      throw error
    }
  }
}

export const gmailApiService = new GmailApiService()
export default gmailApiService
