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
   * 构建邮件原始内容（RFC 2822 格式）
   * @param {Object} mail - 邮件对象
   * @param {string} mail.from - 发件人
   * @param {string|Array} mail.to - 收件人
   * @param {string|Array} mail.cc - 抄送
   * @param {string|Array} mail.bcc - 密送
   * @param {string} mail.subject - 主题
   * @param {string} mail.body - 正文（HTML）
   * @param {string} mail.threadId - 会话 ID（用于回复）
   * @returns {string} Base64 URL 编码的邮件内容
   */
  buildRawMessage(mail) {
    try {
      const lines = []
      
      // From
      if (mail.from) {
        lines.push(`From: ${mail.from}`)
      }
      
      // To
      if (mail.to) {
        const toAddresses = Array.isArray(mail.to) ? mail.to.join(', ') : mail.to
        lines.push(`To: ${toAddresses}`)
      }
      
      // Cc
      if (mail.cc) {
        const ccAddresses = Array.isArray(mail.cc) ? mail.cc.join(', ') : mail.cc
        lines.push(`Cc: ${ccAddresses}`)
      }
      
      // Bcc
      if (mail.bcc) {
        const bccAddresses = Array.isArray(mail.bcc) ? mail.bcc.join(', ') : mail.bcc
        lines.push(`Bcc: ${bccAddresses}`)
      }
      
      // Subject
      const subject = mail.subject || '(无主题)'
      lines.push(`Subject: ${subject}`)
      
      // In-Reply-To（用于回复）
      if (mail.inReplyTo) {
        lines.push(`In-Reply-To: ${mail.inReplyTo}`)
      }
      
      // References（用于回复）
      if (mail.references) {
        lines.push(`References: ${mail.references}`)
      }
      
      // MIME 版本
      lines.push('MIME-Version: 1.0')
      lines.push('Content-Type: text/html; charset=UTF-8')
      lines.push('Content-Transfer-Encoding: 7bit')
      
      // 空行分隔头部和正文
      lines.push('')
      
      // 正文
      lines.push(mail.body || '')
      
      // 拼接并编码
      const rawMessage = lines.join('\r\n')
      const base64Message = btoa(unescape(encodeURIComponent(rawMessage)))
      // 转换为 Base64 URL 编码
      const base64UrlMessage = base64Message.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      
      return base64UrlMessage
    } catch (error) {
      console.error('[Gmail API] Failed to build raw message:', error)
      throw error
    }
  }

  /**
   * 发送新邮件
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {Object} mail - 邮件对象
   * @returns {Promise<Object>} 发送结果
   */
  async send(accessToken, mail) {
    try {
      console.log('[Gmail API] Sending new message...')
      const rawMessage = this.buildRawMessage(mail)
      const result = await this.sendMessage(accessToken, rawMessage)
      console.log('[Gmail API] Message sent successfully:', result.id)
      return result
    } catch (error) {
      console.error('[Gmail API] Failed to send:', error)
      throw error
    }
  }

  /**
   * 回复邮件
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} originalMessageId - 原邮件 ID
   * @param {Object} replyMail - 回复邮件对象
   * @returns {Promise<Object>} 发送结果
   */
  async reply(accessToken, originalMessageId, replyMail) {
    try {
      console.log('[Gmail API] Replying to message:', originalMessageId)
      
      // 获取原邮件以获取会话信息
      const originalMessage = await this.getMessage(accessToken, originalMessageId, 'metadata')
      
      // 提取必要的头部信息
      const headers = {}
      originalMessage.payload?.headers?.forEach(header => {
        const name = header.name.toLowerCase()
        if (['message-id', 'references', 'subject'].includes(name)) {
          headers[name] = header.value
        }
      })
      
      // 构建回复邮件
      const mail = {
        ...replyMail,
        threadId: originalMessage.threadId,
        inReplyTo: headers['message-id'],
        references: headers['references'] 
          ? `${headers['references']} ${headers['message-id']}`
          : headers['message-id'],
        subject: replyMail.subject || `Re: ${headers.subject || ''}`,
      }
      
      const rawMessage = this.buildRawMessage(mail)
      const result = await this.sendMessage(accessToken, rawMessage)
      console.log('[Gmail API] Reply sent successfully:', result.id)
      return result
    } catch (error) {
      console.error('[Gmail API] Failed to reply:', error)
      throw error
    }
  }

  /**
   * 转发邮件
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} originalMessageId - 原邮件 ID
   * @param {Object} forwardMail - 转发邮件对象
   * @returns {Promise<Object>} 发送结果
   */
  async forward(accessToken, originalMessageId, forwardMail) {
    try {
      console.log('[Gmail API] Forwarding message:', originalMessageId)
      
      // 获取原邮件
      const originalMessage = await this.getMessage(accessToken, originalMessageId, 'full')
      const parsed = this.parseMessage(originalMessage)
      
      // 构建转发内容
      const forwardContent = `
        <br/><br/>
        ---------- Forwarded message ---------<br/>
        From: ${parsed.from}<br/>
        Date: ${new Date(parsed.date).toLocaleString()}<br/>
        Subject: ${parsed.subject}<br/>
        To: ${parsed.to}<br/>
        ${parsed.cc ? `Cc: ${parsed.cc}<br/>` : ''}
        <br/><br/>
        ${parsed.html || parsed.text || ''}
      `
      
      const mail = {
        ...forwardMail,
        body: (forwardMail.body || '') + forwardContent,
        subject: forwardMail.subject || `Fwd: ${parsed.subject}`,
      }
      
      return await this.send(accessToken, mail)
    } catch (error) {
      console.error('[Gmail API] Failed to forward:', error)
      throw error
    }
  }

  /**
   * 删除邮件（移到回收站）
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @returns {Promise<Object>} 删除结果
   */
  async trashMessage(accessToken, messageId) {
    try {
      console.log('[Gmail API] Moving message to trash:', messageId)
      const response = await this.makeRequest(`${this.baseUrl}/messages/${messageId}/trash`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      console.log('[Gmail API] Message moved to trash successfully')
      return response
    } catch (error) {
      console.error('[Gmail API] Failed to trash message:', error)
      throw error
    }
  }

  /**
   * 从回收站恢复邮件
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @returns {Promise<Object>} 恢复结果
   */
  async untrashMessage(accessToken, messageId) {
    try {
      console.log('[Gmail API] Untrashing message:', messageId)
      const response = await this.makeRequest(`${this.baseUrl}/messages/${messageId}/untrash`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      console.log('[Gmail API] Message untrashed successfully')
      return response
    } catch (error) {
      console.error('[Gmail API] Failed to untrash message:', error)
      throw error
    }
  }

  /**
   * 永久删除邮件
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @returns {Promise<void>}
   */
  async deleteMessage(accessToken, messageId) {
    try {
      console.log('[Gmail API] Permanently deleting message:', messageId)
      await this.makeRequest(`${this.baseUrl}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      console.log('[Gmail API] Message deleted permanently')
    } catch (error) {
      console.error('[Gmail API] Failed to delete message:', error)
      throw error
    }
  }

  /**
   * 修改邮件标签
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @param {Object} modifications - 修改内容
   * @param {Array<string>} modifications.addLabelIds - 要添加的标签 ID
   * @param {Array<string>} modifications.removeLabelIds - 要移除的标签 ID
   * @returns {Promise<Object>} 修改结果
   */
  async modifyMessage(accessToken, messageId, modifications) {
    try {
      console.log('[Gmail API] Modifying message labels:', messageId)
      const response = await this.makeRequest(`${this.baseUrl}/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modifications),
      })
      console.log('[Gmail API] Message modified successfully')
      return response
    } catch (error) {
      console.error('[Gmail API] Failed to modify message:', error)
      throw error
    }
  }

  /**
   * 标记为已读
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @returns {Promise<Object>} 修改结果
   */
  async markAsRead(accessToken, messageId) {
    return await this.modifyMessage(accessToken, messageId, {
      removeLabelIds: ['UNREAD'],
    })
  }

  /**
   * 标记为未读
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @returns {Promise<Object>} 修改结果
   */
  async markAsUnread(accessToken, messageId) {
    return await this.modifyMessage(accessToken, messageId, {
      addLabelIds: ['UNREAD'],
    })
  }

  /**
   * 添加星标
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @returns {Promise<Object>} 修改结果
   */
  async addStar(accessToken, messageId) {
    return await this.modifyMessage(accessToken, messageId, {
      addLabelIds: ['STARRED'],
    })
  }

  /**
   * 移除星标
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @returns {Promise<Object>} 修改结果
   */
  async removeStar(accessToken, messageId) {
    return await this.modifyMessage(accessToken, messageId, {
      removeLabelIds: ['STARRED'],
    })
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
   * 批量获取邮件详情
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {Array<string>} messageIds - 邮件 ID 列表
   * @param {string} format - 格式 (full, metadata, minimal)
   * @returns {Promise<Array>} 邮件详情列表
   */
  async getMessages(accessToken, messageIds, format = 'full') {
    try {
      console.log(`[Gmail API] Fetching ${messageIds.length} messages...`)
      
      // 分批获取，避免一次请求过多
      const batchSize = 10
      const messages = []
      
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize)
        console.log(`[Gmail API] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messageIds.length / batchSize)}: fetching ${batch.length} messages...`)
        
        const batchPromises = batch.map(id => this.getMessage(accessToken, id, format))
        const batchMessages = await Promise.all(batchPromises)
        messages.push(...batchMessages)
        
        console.log(`[Gmail API] Batch fetched: ${batchMessages.length} messages, total: ${messages.length}/${messageIds.length}`)
      }
      
      return messages
    } catch (error) {
      console.error('[Gmail API] Failed to get messages:', error)
      throw error
    }
  }

  /**
   * 解析 Gmail API 邮件为应用格式
   * @param {Object} message - Gmail API 邮件对象
   * @returns {Object} 应用格式的邮件
   */
  parseMessage(message) {
    try {
      const headers = {}
      message.payload?.headers?.forEach(header => {
        headers[header.name.toLowerCase()] = header.value
      })
      
      // 获取邮件正文
      const getBody = (payload) => {
        let textBody = ''
        let htmlBody = ''
        
        if (payload.body?.data) {
          const mimeType = payload.mimeType || ''
          const decodedBody = this.decodeBase64(payload.body.data)
          
          if (mimeType.includes('text/plain')) {
            textBody = decodedBody
          } else if (mimeType.includes('text/html')) {
            htmlBody = decodedBody
          }
        }
        
        // 递归处理多部分邮件
        if (payload.parts) {
          payload.parts.forEach(part => {
            const partMimeType = part.mimeType || ''
            
            if (partMimeType.includes('text/plain') && part.body?.data) {
              textBody += this.decodeBase64(part.body.data)
            } else if (partMimeType.includes('text/html') && part.body?.data) {
              htmlBody += this.decodeBase64(part.body.data)
            } else if (part.parts) {
              // 递归处理嵌套部分
              const nested = getBody(part)
              textBody += nested.text
              htmlBody += nested.html
            }
          })
        }
        
        return { text: textBody, html: htmlBody }
      }
      
      const body = getBody(message.payload || {})
      
      // 获取附件
      const attachments = []
      const getAttachments = (payload) => {
        if (payload.parts) {
          payload.parts.forEach(part => {
            if (part.filename && part.body?.attachmentId) {
              attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body.size || 0,
                attachmentId: part.body.attachmentId,
              })
            } else if (part.parts) {
              getAttachments(part)
            }
          })
        }
      }
      getAttachments(message.payload || {})
      
      return {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds || [],
        snippet: message.snippet || '',
        from: headers.from || '',
        to: headers.to || '',
        cc: headers.cc || '',
        subject: headers.subject || '(无主题)',
        date: headers.date ? new Date(headers.date) : new Date(parseInt(message.internalDate)),
        text: body.text,
        html: body.html,
        attachments: attachments,
      }
    } catch (error) {
      console.error('[Gmail API] Failed to parse message:', error)
      // 返回基本信息，避免解析失败影响整体
      return {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds || [],
        snippet: message.snippet || '',
        from: '',
        to: '',
        cc: '',
        subject: '(解析失败)',
        date: new Date(),
        text: error.message,
        html: '',
        attachments: [],
      }
    }
  }

  /**
   * 获取邮件附件
   * @param {string} accessToken - OAuth2 访问令牌
   * @param {string} messageId - 邮件 ID
   * @param {string} attachmentId - 附件 ID
   * @returns {Promise<Object>} 附件数据 { data: base64编码的数据, size: 大小 }
   */
  async getAttachment(accessToken, messageId, attachmentId) {
    try {
      console.log(`[Gmail API] Fetching attachment: ${attachmentId} from message: ${messageId}`)
      const url = `${this.baseUrl}/messages/${messageId}/attachments/${attachmentId}`
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      return response
    } catch (error) {
      console.error('[Gmail API] Failed to get attachment:', error)
      throw error
    }
  }

  /**
   * 解码 Base64 URL 编码的字符串
   * @param {string} str - Base64 URL 编码的字符串
   * @returns {string} 解码后的字符串
   */
  decodeBase64(str) {
    try {
      // Gmail API 使用 Base64 URL 编码，需要转换
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      // 添加 padding
      const padding = '='.repeat((4 - base64.length % 4) % 4)
      const paddedBase64 = base64 + padding

      // 解码
      return decodeURIComponent(escape(atob(paddedBase64)))
    } catch (error) {
      console.error('[Gmail API] Failed to decode base64:', error)
      return ''
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
