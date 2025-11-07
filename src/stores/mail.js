import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storageService } from '@/services/storage'
import { useAccountStore } from './account'
import { useAppStore } from './app'

/**
 * 检查并刷新 OAuth2 令牌（如果需要）
 * @param {Object} account - 账户对象
 * @param {Object} accountStore - 账户 store
 * @returns {Promise<string>} 有效的访问令牌
 */
async function ensureValidToken(account, accountStore) {
  // 如果不是 OAuth2 账户，直接返回 accessToken
  if (!account.oauth2 || !account.accessToken) {
    return account.accessToken || account.password
  }
  
  // 检查令牌是否过期（提刕5分钟刷新）
  const expiresAt = account.expiresAt || 0
  const now = Date.now()
  const bufferTime = 5 * 60 * 1000 // 5分钟缓冲时间
  
  if (expiresAt > now + bufferTime) {
    // 令牌还有效
    console.log('[Mail] Access token is valid')
    return account.accessToken
  }
  
  // 令牌已过期或即将过期，需要刷新
  console.log('[Mail] Access token expired or expiring soon, refreshing...')
  
  if (!account.refreshToken) {
    throw new Error('访问令牌已过期且没有刷新令牌，请重新登录')
  }
  
  try {
    const { oauth2Service } = await import('@/services/oauth')
    const tokenResult = await oauth2Service.refreshToken(
      account.provider || 'gmail',
      account.refreshToken
    )
    
    // 更新账户的令牌信息
    await accountStore.updateAccount(account.id, {
      accessToken: tokenResult.accessToken,
      expiresAt: tokenResult.expiresAt,
    })
    
    console.log('[Mail] Token refreshed successfully, new expiration:', new Date(tokenResult.expiresAt))
    return tokenResult.accessToken
  } catch (error) {
    console.error('[Mail] Failed to refresh token:', error)
    throw new Error(`访问令牌刷新失败: ${error.message}，请重新登录`)
  }
}

/**
 * 邮件管理状态
 */
export const useMailStore = defineStore('mail', () => {
  const accountStore = useAccountStore()
  const appStore = useAppStore()

  // 邮件列表
  const mails = ref([])
  
  // 当前文件夹
  const currentFolder = ref('inbox')
  
  // 文件夹列表（包括服务器文件夹）
  const folders = ref([
    { id: 'inbox', name: '收件箱', icon: 'InboxOutlined', system: true },
    { id: 'sent', name: '已发送', icon: 'SendOutlined', system: true },
    { id: 'drafts', name: '草稿箱', icon: 'EditOutlined', system: true },
    { id: 'trash', name: '回收站', icon: 'DeleteOutlined', system: true },
    { id: 'starred', name: '星标邮件', icon: 'StarOutlined', system: true },
  ])
  
  // 同步状态
  const isSyncing = ref(false)
  const lastSyncTime = ref(null)
  
  // 选中的邮件
  const selectedMailIds = ref([])
  
  // 筛选条件
  const filter = ref({
    type: 'all', // all, unread, read, flagged, attachment
    dateRange: null,
    limit: 50,
  })
  
  /**
   * 当前文件夹的邮件列表
   */
  const currentMails = computed(() => {
    let filtered = []

    // starred 文件夹特殊处理：显示所有星标邮件
    if (currentFolder.value === 'starred') {
      filtered = mails.value.filter(mail => mail.flagged)
    } else {
      // 其他文件夹按 folder 字段筛选
      filtered = mails.value.filter(mail => mail.folder === currentFolder.value)
    }

    // 应用筛选
    if (filter.value.type === 'unread') {
      filtered = filtered.filter(mail => !mail.read)
    } else if (filter.value.type === 'read') {
      filtered = filtered.filter(mail => mail.read)
    } else if (filter.value.type === 'flagged') {
      filtered = filtered.filter(mail => mail.flagged)
    } else if (filter.value.type === 'attachment') {
      filtered = filtered.filter(mail => mail.hasAttachment)
    }

    // 按日期排序（最新的在前）
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
    
    // 限制数量
    if (filter.value.limit) {
      filtered = filtered.slice(0, filter.value.limit)
    }
    
    return filtered
  })
  
  /**
   * 未读邮件数量
   */
  const unreadCount = computed(() => {
    return mails.value.filter(mail => !mail.read && mail.folder === 'inbox').length
  })
  
  /**
   * 加载邮件列表
   * 加载当前账户的所有邮件，不按文件夹区分
   */
  async function loadMails(folder = 'inbox') {
    try {
      const accountId = accountStore.currentAccountId
      if (!accountId) return

      // 加载当前账户的所有邮件（不按文件夹区分）
      const data = await storageService.loadMails(accountId, 'all')
      mails.value = data || []

      console.log(`[Mail] Loaded ${mails.value.length} mails for account ${accountId}`)
    } catch (error) {
      console.error('Failed to load mails:', error)
      mails.value = []
    }
  }

  /**
   * 从服务器拉取邮件
   * @param {string} folderName - 文件夹名称（默认 'INBOX'）
   * @param {Object} options - 选项
   * @param {number} options.limit - 限制数量（默认 50）
   * @param {Date} options.since - 从某个日期开始
   * @param {boolean} options.unreadOnly - 只拉取未读邮件
   */
  async function fetchMailsFromServer(folderName = 'INBOX', options = {}) {
    try {
      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      if (!window.electronAPI) {
        console.warn('[Mail] Not in Electron environment, skipping fetch')
        return []
      }

      console.log(`[Mail] Fetching mails from ${folderName}...`)

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken) {
        // 使用 Gmail API 拉取邮件
        return await fetchMailsFromGmailAPI(folderName, options)
      } else {
        // 使用 IMAP 拉取邮件
        return await fetchMailsFromIMAP(folderName, options)
      }
    } catch (error) {
      console.error('[Mail] Failed to fetch mails:', error)
      throw error
    }
  }

  /**
   * 使用 Gmail API 拉取邮件
   */
  async function fetchMailsFromGmailAPI(folderName = 'INBOX', options = {}) {
    try {
      const account = accountStore.currentAccount
      console.log('[Mail] Using Gmail API to fetch mails...')

      // 获取有效的访问令牌
      const accessToken = await ensureValidToken(account, accountStore)

      // 映射文件夹名称到 Gmail 标签 ID
      const folderToLabelMap = {
        'INBOX': 'INBOX',
        'inbox': 'INBOX',
        'SENT': 'SENT',
        'sent': 'SENT',
        'DRAFT': 'DRAFT',
        'drafts': 'DRAFT',
        'TRASH': 'TRASH',
        'trash': 'TRASH',
        'SPAM': 'SPAM',
        'spam': 'SPAM',
        'STARRED': 'STARRED',
        'starred': 'STARRED',
      }

      // 映射 Gmail 标签 ID 到系统文件夹 ID
      const labelToSystemFolderMap = {
        'INBOX': 'inbox',
        'SENT': 'sent',
        'DRAFT': 'drafts',
        'TRASH': 'trash',
        'SPAM': 'spam',
        'STARRED': 'starred',
      }

      const labelId = folderToLabelMap[folderName] || 'INBOX'
      const systemFolderId = labelToSystemFolderMap[labelId] || folderName.toLowerCase()
      console.log(`[Mail] Fetching from Gmail label: ${labelId}, mapping to folder: ${systemFolderId}`)

      // 1. 获取邮件列表
      const { gmailApiService } = await import('@/services/gmail-api')
      
      const listOptions = {
        labelIds: labelId,
        maxResults: options.limit || 50,
      }

      // 构建搜索查询
      const queries = []
      if (options.unreadOnly) {
        queries.push('is:unread')
      }
      if (options.since) {
        const sinceDate = new Date(options.since)
        const dateStr = sinceDate.toISOString().split('T')[0].replace(/-/g, '/')
        queries.push(`after:${dateStr}`)
      }
      if (queries.length > 0) {
        listOptions.q = queries.join(' ')
      }

      console.log('[Mail] Listing messages...', listOptions)
      const messageList = await gmailApiService.listMessages(accessToken, listOptions)
      console.log(`[Mail] Found ${messageList.length} messages`)

      if (messageList.length === 0) {
        return []
      }

      // 2. 批量获取邮件详情
      const messageIds = messageList.map(m => m.id)
      console.log(`[Mail] Fetching details for ${messageIds.length} messages...`)
      
      const messages = await gmailApiService.getMessages(accessToken, messageIds, 'full')
      console.log(`[Mail] Fetched ${messages.length} messages with details`)

      // 3. 解析并转换为应用数据格式
      const newMails = messages.map(message => {
        const parsed = gmailApiService.parseMessage(message)
        
        return {
          id: `${accountStore.currentAccountId}_${parsed.id}_${Date.now()}`,
          gmailId: parsed.id,
          gmailThreadId: parsed.threadId,
          accountId: accountStore.currentAccountId,
          folder: systemFolderId,  // 使用映射后的系统文件夹 ID
          from: parsed.from,
          to: parsed.to,
          cc: parsed.cc,
          subject: parsed.subject,
          date: parsed.date,
          preview: parsed.text?.substring(0, 200) || parsed.snippet || '',
          body: parsed.html || parsed.text || '',
          read: !parsed.labelIds.includes('UNREAD'),
          flagged: parsed.labelIds.includes('STARRED'),
          hasAttachment: parsed.attachments.length > 0,
          attachments: parsed.attachments,
          receivedAt: new Date().toISOString(),
        }
      })

      // 4. 合并到本地邮件列表（去重）
      newMails.forEach(newMail => {
        const exists = mails.value.find(m => m.gmailId === newMail.gmailId)
        if (!exists) {
          mails.value.unshift(newMail)
        }
      })

      // 5. 保存到本地
      await saveMails()

      console.log(`[Mail] Gmail API fetch completed: ${newMails.length} mails`)
      return newMails
    } catch (error) {
      console.error('[Mail] Gmail API fetch failed:', error)
      throw error
    }
  }

  /**
   * 使用 IMAP 拉取邮件
   */
  async function fetchMailsFromIMAP(folderName = 'INBOX', options = {}) {
    try {
      const account = accountStore.currentAccount
      console.log('[Mail] Using IMAP to fetch mails...')

      // 获取有效的访问令牌（如果是 OAuth2 账户）
      const password = await ensureValidToken(account, accountStore)

      // 映射 IMAP 文件夹名称到系统文件夹 ID
      const imapFolderMapping = {
        // 英文标准
        'INBOX': 'inbox',
        'Sent': 'sent',
        'Sent Messages': 'sent',
        'Sent Items': 'sent',
        'Drafts': 'drafts',
        'Trash': 'trash',
        'Deleted': 'trash',
        'Deleted Messages': 'trash',
        'Junk': 'spam',
        'Spam': 'spam',
        // 中文（QQ、163、126等）
        '收件箱': 'inbox',
        '已发送': 'sent',
        '已发邮件': 'sent',
        '发件箱': 'sent',
        '草稿箱': 'drafts',
        '已删除': 'trash',
        '已删': 'trash',
        '垃圾邮件': 'spam',
        '垃圾箱': 'spam',
        '广告邮件': 'spam',
      }

      // 尝试映射文件夹名称，如果没有映射则使用小写的原名称
      let systemFolderId = imapFolderMapping[folderName]

      if (!systemFolderId) {
        // 模糊匹配
        const nameLower = folderName.toLowerCase()
        if (nameLower === 'inbox') {
          systemFolderId = 'inbox'
        } else if (nameLower.includes('sent') || nameLower.includes('发送') || nameLower.includes('发件')) {
          systemFolderId = 'sent'
        } else if (nameLower.includes('draft') || nameLower.includes('草稿')) {
          systemFolderId = 'drafts'
        } else if (nameLower.includes('trash') || nameLower.includes('deleted') || nameLower.includes('删除')) {
          systemFolderId = 'trash'
        } else if (nameLower.includes('junk') || nameLower.includes('spam') || nameLower.includes('垃圾') || nameLower.includes('广告')) {
          systemFolderId = 'spam'
        } else {
          // 如果无法识别，使用小写的原文件夹名
          systemFolderId = folderName.toLowerCase()
        }
      }

      console.log(`[Mail] IMAP folder "${folderName}" mapped to system folder "${systemFolderId}"`)

      // 1. 连接 IMAP
      console.log('[Mail] Connecting to IMAP...')
      try {
        await window.electronAPI.connectImap({
          email: account.email,
          password: password,
          imapHost: account.imapHost,
          imapPort: account.imapPort,
        })
        console.log('[Mail] IMAP connection established')
      } catch (error) {
        console.error('[Mail] IMAP connection failed:', error)
        throw new Error(`IMAP 连接失败: ${error.message}`)
      }

      // 2. 打开文件夹
      console.log(`[Mail] Opening folder: ${folderName}`)
      try {
        await window.electronAPI.openImapFolder(folderName)
        console.log(`[Mail] Folder opened: ${folderName}`)
      } catch (error) {
        console.error('[Mail] Failed to open folder:', error)
        // 关闭连接
        await window.electronAPI.disconnectImap()
        throw new Error(`打开文件夹失败: ${error.message}`)
      }

      // 3. 构建搜索条件
      const criteria = []
      
      if (options.unreadOnly) {
        criteria.push('UNSEEN')
      }
      
      if (options.since) {
        const sinceDate = new Date(options.since)
        criteria.push(['SINCE', sinceDate])
      }
      
      // 如果没有条件，搜索所有邮件
      if (criteria.length === 0) {
        criteria.push('ALL')
      }

      // 4. 搜索邮件
      console.log('[Mail] Searching mails...')
      const uids = await window.electronAPI.searchImapMails(criteria)
      console.log(`[Mail] Found ${uids.length} mails`)

      if (uids.length === 0) {
        await window.electronAPI.disconnectImap()
        return []
      }

      // 5. 限制数量（取最新的）
      const limit = options.limit || 50
      const fetchUids = uids.slice(-limit)
      
      console.log(`[Mail] Fetching ${fetchUids.length} mails (limited from ${uids.length})...`)

      // 6. 批量获取并解析邮件（分批处理避免超时）
      const batchSize = 10 // 每批次10封
      const fetchedMails = []
      
      for (let i = 0; i < fetchUids.length; i += batchSize) {
        const batch = fetchUids.slice(i, i + batchSize)
        console.log(`[Mail] Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(fetchUids.length / batchSize)} (${batch.length} mails)...`)
        
        try {
          const batchMails = await window.electronAPI.fetchAndParseImapMails(batch)
          fetchedMails.push(...batchMails)
          console.log(`[Mail] Batch fetched: ${batchMails.length} mails, total: ${fetchedMails.length}/${fetchUids.length}`)
        } catch (error) {
          console.error(`[Mail] Batch fetch failed:`, error)
          // 继续处理下一批，不要因为一批失败而停止
          continue
        }
      }
      
      console.log(`[Mail] Fetched total ${fetchedMails.length} mails`)

      // 7. 转换为应用数据格式
      const newMails = fetchedMails.map(mail => ({
        id: `${accountStore.currentAccountId}_${mail.uid}_${Date.now()}`,
        uid: mail.uid,
        accountId: accountStore.currentAccountId,
        folder: systemFolderId,  // 使用映射后的系统文件夹 ID
        from: mail.parsed?.from || '',
        to: mail.parsed?.to || '',
        cc: mail.parsed?.cc || '',
        subject: mail.parsed?.subject || '(无主题)',
        date: mail.parsed?.date || new Date(),
        preview: mail.parsed?.text?.substring(0, 200) || '',
        body: mail.parsed?.html || mail.parsed?.textAsHtml || mail.parsed?.text || '',
        read: mail.flags?.includes('\\Seen') || false,
        flagged: mail.flags?.includes('\\Flagged') || false,
        hasAttachment: (mail.parsed?.attachments?.length || 0) > 0,
        attachments: mail.parsed?.attachments || [],
        receivedAt: new Date().toISOString(),
      }))

      // 8. 断开连接
      console.log('[Mail] Disconnecting from IMAP...')
      await window.electronAPI.disconnectImap()

      // 9. 合并到本地邮件列表（去重）
      newMails.forEach(newMail => {
        const exists = mails.value.find(m => m.uid === newMail.uid)
        if (!exists) {
          mails.value.unshift(newMail)
        }
      })

      // 10. 保存到本地
      await saveMails()

      return newMails
    } catch (error) {
      console.error('[Mail] IMAP fetch failed:', error)
      
      // 确保断开连接
      if (window.electronAPI) {
        try {
          console.log('[Mail] Cleaning up: disconnecting...')
          await window.electronAPI.disconnectImap()
        } catch (e) {
          console.warn('[Mail] Disconnect error (ignored):', e.message)
        }
      }
      
      throw error
    }
  }
  
  /**
   * 添加邮件
   */
  async function addMail(mail) {
    try {
      const newMail = {
        id: Date.now().toString(),
        accountId: accountStore.currentAccountId,
        folder: currentFolder.value,
        read: false,
        flagged: false,
        ...mail,
        receivedAt: new Date().toISOString(),
      }
      
      mails.value.unshift(newMail)
      await saveMails()
      
      return newMail
    } catch (error) {
      console.error('Failed to add mail:', error)
      throw error
    }
  }
  
  /**
   * 更新邮件
   */
  async function updateMail(mailId, updates) {
    try {
      const index = mails.value.findIndex(mail => mail.id === mailId)
      if (index !== -1) {
        mails.value[index] = {
          ...mails.value[index],
          ...updates,
        }
        await saveMails()
      }
    } catch (error) {
      console.error('Failed to update mail:', error)
      throw error
    }
  }
  
  /**
   * 删除邮件（移至回收站）
   * 同步到服务器
   */
  async function deleteMail(mailId) {
    try {
      // 调用服务器删除方法
      await deleteMailFromServer(mailId)
    } catch (error) {
      console.error('[Mail] Failed to delete mail:', error)
      throw error
    }
  }
  
  /**
   * 永久删除邮件
   * 同步到服务器
   */
  async function permanentlyDeleteMail(mailId) {
    try {
      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      const mail = mails.value.find(m => m.id === mailId)
      if (!mail) {
        throw new Error('邮件不存在')
      }

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
        // 使用 Gmail API 永久删除
        console.log('[Mail] Permanently deleting via Gmail API...')
        const accessToken = await ensureValidToken(account, accountStore)
        const { gmailApiService } = await import('@/services/gmail-api')
        
        await gmailApiService.deleteMessage(accessToken, mail.gmailId)
        console.log('[Mail] Permanently deleted via Gmail API successfully')
      } else if (window.electronAPI && mail.uid) {
        // 使用 IMAP 删除
        console.log('[Mail] Permanently deleting via IMAP...')
        const password = await ensureValidToken(account, accountStore)
        
        await window.electronAPI.connectImap({
          email: account.email,
          password: password,
          imapHost: account.imapHost,
          imapPort: account.imapPort,
        })
        
        await window.electronAPI.openImapFolder(mail.folder || 'TRASH')
        await window.electronAPI.deleteImapMail(mail.uid)
        await window.electronAPI.disconnectImap()
        
        console.log('[Mail] Permanently deleted via IMAP successfully')
      }
      
      // 删除本地数据
      mails.value = mails.value.filter(m => m.id !== mailId)
      await saveMails()
    } catch (error) {
      console.error('[Mail] Failed to permanently delete mail:', error)
      throw error
    }
  }
  
  /**
   * 标记为已读/未读（同步到服务器）
   */
  async function markAsRead(mailId, read = true) {
    try {
      await markAsReadOnServer(mailId, read)
    } catch (error) {
      console.error('[Mail] Failed to mark as read:', error)
      throw error
    }
  }
  
  /**
   * 切换星标（同步到服务器）
   */
  async function toggleFlag(mailId) {
    try {
      await toggleFlagOnServer(mailId)
    } catch (error) {
      console.error('[Mail] Failed to toggle flag:', error)
      throw error
    }
  }
  
  /**
   * 切换文件夹
   * 只切换当前文件夹，不重新加载邮件（currentMails 会自动过滤）
   */
  function switchFolder(folder) {
    console.log(`[Mail] Switching folder to: ${folder}`)
    currentFolder.value = folder
  }
  
  /**
   * 更新筛选条件
   */
  function updateFilter(newFilter) {
    filter.value = { ...filter.value, ...newFilter }
  }
  
  /**
   * 保存邮件列表
   * 保存当前账户的所有邮件，不按文件夹区分
   */
  async function saveMails() {
    try {
      const accountId = accountStore.currentAccountId
      if (!accountId) return

      // 保存所有邮件到统一的存储位置
      await storageService.saveMails(accountId, 'all', mails.value)

      console.log(`[Mail] Saved ${mails.value.length} mails for account ${accountId}`)
    } catch (error) {
      console.error('Failed to save mails:', error)
      throw error
    }
  }
  
  /**
   * 选择邮件
   */
  function selectMail(mailId) {
    if (!selectedMailIds.value.includes(mailId)) {
      selectedMailIds.value.push(mailId)
    }
  }
  
  /**
   * 取消选择
   */
  function unselectMail(mailId) {
    selectedMailIds.value = selectedMailIds.value.filter(id => id !== mailId)
  }
  
  /**
   * 清空选择
   */
  function clearSelection() {
    selectedMailIds.value = []
  }

  /**
   * 同步服务器文件夹
   * 从 IMAP 服务器或 Gmail API 获取文件夹列表并与本地合并
   */
  async function syncServerFolders() {
    try {
      isSyncing.value = true
      const account = accountStore.currentAccount
      
      if (!account) {
        throw new Error('请先选择账户')
      }

      // 如果是 Electron 环境，从真实服务器获取文件夹
      if (window.electronAPI) {
        try {
          // 检测是否为 Gmail 账户（通过 provider 或 imapHost 判断）
          const isGmail = account.provider === 'gmail' || 
                          account.imapHost?.includes('gmail.com') ||
                          account.email?.endsWith('@gmail.com')
          
          if (isGmail && account.accessToken) {
            console.log('[Mail] Syncing Gmail folders via API...')
            
            // 获取有效的访问令牌（如果需要会自动刷新）
            const accessToken = await ensureValidToken(account, accountStore)
            
            // 使用 Gmail API 获取标签（文件夹）
            const { gmailApiService } = await import('@/services/gmail-api')
            const labels = await gmailApiService.getLabels(accessToken)
            
            console.log('[Mail] Gmail labels:', labels)
            
            // Gmail 系统标签映射
            const gmailSystemLabels = {
              'INBOX': 'inbox',
              'SENT': 'sent',
              'DRAFT': 'drafts',
              'TRASH': 'trash',
              'SPAM': 'spam',
              'STARRED': 'starred',
            }
            
            // ✅ 创建新数组存储更新后的文件夹
            const updatedFolders = [...folders.value]
            const newFolders = []
            
            // 处理标签
            labels.forEach(label => {
              const mappedId = gmailSystemLabels[label.id]
              
              if (mappedId) {
                // 系统标签，更新已有的系统文件夹
                const folder = updatedFolders.find(f => f.id === mappedId)
                if (folder) {
                  folder.gmailLabelId = label.id
                  folder.gmailLabelName = label.name
                  folder.messageTotal = label.messageTotal
                  folder.messageUnread = label.messageUnread
                }
              } else if (label.type === 'system') {
                // 其他系统标签，按名称处理
                const exists = updatedFolders.find(f => f.gmailLabelId === label.id)
                if (!exists) {
                  newFolders.push({
                    id: `gmail_${label.id}`,
                    name: label.name,
                    gmailLabelId: label.id,
                    gmailLabelName: label.name,
                    messageTotal: label.messageTotal,
                    messageUnread: label.messageUnread,
                    icon: 'FolderOutlined',
                    system: true,
                  })
                }
              } else {
                // 用户自定义标签
                const exists = updatedFolders.find(f => f.gmailLabelId === label.id)
                if (!exists) {
                  newFolders.push({
                    id: `gmail_${label.id}`,
                    name: label.name,
                    gmailLabelId: label.id,
                    gmailLabelName: label.name,
                    messageTotal: label.messageTotal,
                    messageUnread: label.messageUnread,
                    icon: 'FolderOutlined',
                    system: false,
                  })
                } else {
                  // 更新计数
                  exists.messageTotal = label.messageTotal
                  exists.messageUnread = label.messageUnread
                }
              }
            })
            
            // ✅ 一次性更新整个数组，触发响应式更新
            folders.value = [...updatedFolders, ...newFolders]
            
          } else {
            // 非 Gmail 账户，使用 IMAP
            console.log('[Mail] Syncing folders via IMAP...')
            
            // 先连接 IMAP
            await window.electronAPI.connectImap({
              email: account.email,
              password: account.password || account.accessToken,
              imapHost: account.imapHost,
              imapPort: account.imapPort,
            })

            // 获取服务器文件夹列表
            const serverFolders = await window.electronAPI.getServerFolders()
            console.log('[Mail] Server folders:', serverFolders)

            // 映射常见文件夹名称到系统文件夹（支持中文和英文）
            const folderMapping = {
              // 英文
              'INBOX': 'inbox',
              'Sent': 'sent',
              'Sent Messages': 'sent',
              'Sent Items': 'sent',
              'Drafts': 'drafts',
              'Trash': 'trash',
              'Deleted': 'trash',
              'Deleted Messages': 'trash',
              'Junk': 'spam',
              'Spam': 'spam',
              // 中文（QQ、163、126等）
              '收件箱': 'inbox',
              '已发送': 'sent',
              '已发邮件': 'sent',
              '发件箱': 'sent',
              '草稿箱': 'drafts',
              '已删除': 'trash',
              '已删': 'trash',
              '垃圾邮件': 'spam',
              '垃圾箱': 'spam',
              '广告邮件': 'spam',
              // QQ邮箱特殊文件夹
              'Sent Messages': 'sent',
              'Deleted Messages': 'trash',
              'Junk': 'spam',
            }

            // ✅ 创建新数组存储更新后的文件夹
            const updatedFolders = [...folders.value]
            const newFolders = []
            
            // 处理服务器文件夹
            serverFolders.forEach(serverFolder => {
              // 先尝试通过名称映射
              let mappedId = folderMapping[serverFolder.name]
              
              // 如果名称没有匹配，尝试通过路径映射
              if (!mappedId) {
                mappedId = folderMapping[serverFolder.path]
              }
              
              // 如果还是没有，尝试模糊匹配（大小写不敏感）
              if (!mappedId) {
                const nameLower = serverFolder.name.toLowerCase()
                const pathLower = serverFolder.path.toLowerCase()
                
                // 模糊匹配逻辑
                if (nameLower === 'inbox' || pathLower === 'inbox') {
                  mappedId = 'inbox'
                } else if (nameLower.includes('sent') || pathLower.includes('sent') || 
                           nameLower.includes('发送') || nameLower.includes('发件')) {
                  mappedId = 'sent'
                } else if (nameLower.includes('draft') || pathLower.includes('draft') ||
                           nameLower.includes('草稿')) {
                  mappedId = 'drafts'
                } else if (nameLower.includes('trash') || nameLower.includes('deleted') ||
                           pathLower.includes('trash') || pathLower.includes('deleted') ||
                           nameLower.includes('删除')) {
                  mappedId = 'trash'
                } else if (nameLower.includes('junk') || nameLower.includes('spam') ||
                           pathLower.includes('junk') || pathLower.includes('spam') ||
                           nameLower.includes('垃圾') || nameLower.includes('广告')) {
                  mappedId = 'spam'
                }
              }
              
              if (mappedId) {
                // 更新系统文件夹的服务器路径
                const folder = updatedFolders.find(f => f.id === mappedId)
                if (folder) {
                  folder.serverPath = serverFolder.path
                  folder.delimiter = serverFolder.delimiter
                  console.log(`[Mail] Mapped server folder "${serverFolder.path}" to system folder "${mappedId}"`)
                }
              } else {
                // 自定义文件夹，添加到列表
                const exists = updatedFolders.find(f => f.serverPath === serverFolder.path)
                if (!exists) {
                  const customFolder = {
                    id: `server_${serverFolder.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    name: serverFolder.name,
                    serverPath: serverFolder.path,
                    delimiter: serverFolder.delimiter,
                    icon: 'FolderOutlined',
                    system: false,
                  }
                  console.log(`[Mail] Added custom folder "${serverFolder.path}" as "${customFolder.id}"`)
                  newFolders.push(customFolder)
                }
              }
            })

            // ✅ 一次性更新整个数组，触发响应式更新
            folders.value = [...updatedFolders, ...newFolders]
            
            // 断开连接
            await window.electronAPI.disconnectImap()
          }

        } catch (error) {
          console.error('[Mail] Failed to fetch server folders:', error)
          throw error
        }
      } else {
        // 浏览器模式，使用模拟数据
        const serverFolders = [
          { id: 'work', name: '工作邮件', icon: 'FolderOutlined', system: false },
          { id: 'personal', name: '个人邮件', icon: 'FolderOutlined', system: false },
        ]
        
        // ✅ 创建新数组
        const newFolders = []
        serverFolders.forEach(serverFolder => {
          const exists = folders.value.find(f => f.id === serverFolder.id)
          if (!exists) {
            newFolders.push(serverFolder)
          }
        })
        
        // ✅ 一次性更新整个数组
        if (newFolders.length > 0) {
          folders.value = [...folders.value, ...newFolders]
        }
      }
      
      lastSyncTime.value = new Date().toISOString()
      
      // 按账户保存文件夹
      const accountId = accountStore.currentAccountId
      if (accountId) {
        await storageService.writeJSON(`folders_${accountId}.json`, {
          folders: folders.value,
          lastSyncTime: lastSyncTime.value,
        })
        console.log(`[Mail] Saved ${folders.value.length} folders for account ${accountId}`)
      }
      
      console.log('[Mail] Folder sync completed, total folders:', folders.value.length)
      return folders.value
    } catch (error) {
      console.error('Failed to sync folders:', error)
      throw error
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * 加载本地文件夹列表
   */
  async function loadFolders() {
    try {
      const accountId = accountStore.currentAccountId
      if (!accountId) {
        console.log('[Mail] No current account, using default folders')
        return
      }
      
      // 按账户加载文件夹
      const data = await storageService.readJSON(`folders_${accountId}.json`)
      if (data) {
        folders.value = data.folders || getDefaultFolders()
        lastSyncTime.value = data.lastSyncTime
        console.log(`[Mail] Loaded ${folders.value.length} folders for account ${accountId}`)
      } else {
        // 如果没有数据，使用默认文件夹
        folders.value = getDefaultFolders()
        console.log('[Mail] Using default folders')
      }
    } catch (error) {
      console.error('[Mail] Failed to load folders:', error)
      // 加载失败时使用默认文件夹
      folders.value = getDefaultFolders()
    }
  }
  
  /**
   * 获取默认文件夹列表
   */
  function getDefaultFolders() {
    return [
      { id: 'inbox', name: '收件箱', icon: 'InboxOutlined', system: true },
      { id: 'sent', name: '已发送', icon: 'SendOutlined', system: true },
      { id: 'drafts', name: '草稿箱', icon: 'EditOutlined', system: true },
      { id: 'trash', name: '回收站', icon: 'DeleteOutlined', system: true },
      { id: 'starred', name: '星标邮件', icon: 'StarOutlined', system: true },
    ]
  }

  /**
   * 创建自定义文件夹
   */
  async function createFolder(folderName) {
    try {
      const accountId = accountStore.currentAccountId
      if (!accountId) {
        throw new Error('请先选择账户')
      }
      
      const newFolder = {
        id: `custom_${Date.now()}`,
        name: folderName,
        icon: 'FolderOutlined',
        system: false,
        createdAt: new Date().toISOString(),
      }
      
      folders.value.push(newFolder)
      
      // 按账户保存
      await storageService.writeJSON(`folders_${accountId}.json`, {
        folders: folders.value,
        lastSyncTime: lastSyncTime.value,
      })
      
      // TODO: 同步到 IMAP 服务器
      // await imapService.createFolder(folderName)
      
      return newFolder
    } catch (error) {
      console.error('Failed to create folder:', error)
      throw error
    }
  }

  /**
   * 删除自定义文件夹
   */
  async function deleteFolder(folderId) {
    try {
      const accountId = accountStore.currentAccountId
      if (!accountId) {
        throw new Error('请先选择账户')
      }
      
      const folder = folders.value.find(f => f.id === folderId)
      if (!folder || folder.system) {
        throw new Error('无法删除系统文件夹')
      }
      
      folders.value = folders.value.filter(f => f.id !== folderId)
      
      // 按账户保存
      await storageService.writeJSON(`folders_${accountId}.json`, {
        folders: folders.value,
        lastSyncTime: lastSyncTime.value,
      })
      
      // TODO: 同步到 IMAP 服务器
      // await imapService.deleteFolder(folder.name)
    } catch (error) {
      console.error('Failed to delete folder:', error)
      throw error
    }
  }

  /**
   * 移动邮件到文件夹
   */
  async function moveMailToFolder(mailId, targetFolderId) {
    try {
      await updateMail(mailId, { folder: targetFolderId })
      
      // TODO: 同步到 IMAP 服务器
      // const mail = mails.value.find(m => m.id === mailId)
      // if (mail && mail.uid) {
      //   await imapService.moveMail(mail.uid, targetFolderId)
      // }
    } catch (error) {
      console.error('Failed to move mail:', error)
      throw error
    }
  }

  /**
   * 发送邮件（Gmail API 或 SMTP）
   * @param {Object} mailData - 邮件数据
   * @returns {Promise<Object>} 发送结果
   */
  async function sendMail(mailData) {
    try {
      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken) {
        // 使用 Gmail API 发送
        console.log('[Mail] Sending via Gmail API...')
        const accessToken = await ensureValidToken(account, accountStore)
        const { gmailApiService } = await import('@/services/gmail-api')
        
        const mail = {
          from: account.email,
          to: mailData.to,
          cc: mailData.cc,
          bcc: mailData.bcc,
          subject: mailData.subject,
          body: mailData.body,
        }
        
        const result = await gmailApiService.send(accessToken, mail)
        console.log('[Mail] Sent via Gmail API successfully')
        return result
      } else {
        // 使用 SMTP 发送
        console.log('[Mail] Sending via SMTP...')
        if (!window.electronAPI) {
          throw new Error('非 Electron 环境，无法发送邮件')
        }
        
        const password = await ensureValidToken(account, accountStore)
        
        const result = await window.electronAPI.sendEmail({
          config: {
            email: account.email,
            password: password,
            smtpHost: account.smtpHost,
            smtpPort: account.smtpPort,
          },
          mailOptions: {
            from: account.email,
            to: mailData.to,
            cc: mailData.cc,
            bcc: mailData.bcc,
            subject: mailData.subject,
            html: mailData.body,
          },
        })
        
        console.log('[Mail] Sent via SMTP successfully')
        return result
      }
    } catch (error) {
      console.error('[Mail] Failed to send mail:', error)
      throw error
    }
  }

  /**
   * 回复邮件
   * @param {string} mailId - 原邮件 ID
   * @param {Object} replyData - 回复数据
   * @returns {Promise<Object>} 发送结果
   */
  async function replyMail(mailId, replyData) {
    try {
      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      const mail = mails.value.find(m => m.id === mailId)
      if (!mail) {
        throw new Error('邮件不存在')
      }

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
        // 使用 Gmail API 回复
        console.log('[Mail] Replying via Gmail API...')
        const accessToken = await ensureValidToken(account, accountStore)
        const { gmailApiService } = await import('@/services/gmail-api')
        
        const replyMail = {
          from: account.email,
          to: replyData.to || mail.from,
          cc: replyData.cc,
          bcc: replyData.bcc,
          subject: replyData.subject,
          body: replyData.body,
        }
        
        const result = await gmailApiService.reply(accessToken, mail.gmailId, replyMail)
        console.log('[Mail] Replied via Gmail API successfully')
        return result
      } else {
        // 使用 SMTP 发送回复
        console.log('[Mail] Replying via SMTP...')
        return await sendMail({
          to: replyData.to || mail.from,
          cc: replyData.cc,
          bcc: replyData.bcc,
          subject: replyData.subject || `Re: ${mail.subject}`,
          body: replyData.body,
        })
      }
    } catch (error) {
      console.error('[Mail] Failed to reply:', error)
      throw error
    }
  }

  /**
   * 删除邮件（同步到服务器）
   * @param {string} mailId - 邮件 ID
   * @returns {Promise<void>}
   */
  async function deleteMailFromServer(mailId) {
    try {
      const mail = mails.value.find(m => m.id === mailId)
      if (!mail) {
        throw new Error('邮件不存在')
      }

      // 检查是否需要同步到服务器
      if (!appStore.settings.syncDeleteToServer) {
        console.log('[Mail] Delete sync disabled, only updating local state')
        // 只更新本地状态
        await updateMail(mailId, { folder: 'trash' })
        return
      }

      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
        // 使用 Gmail API 删除（移到回收站）
        console.log('[Mail] Moving to trash via Gmail API...')
        const accessToken = await ensureValidToken(account, accountStore)
        const { gmailApiService } = await import('@/services/gmail-api')
        
        await gmailApiService.trashMessage(accessToken, mail.gmailId)
        console.log('[Mail] Moved to trash via Gmail API successfully')
        
        // 更新本地状态
        await updateMail(mailId, { folder: 'trash' })
      } else if (window.electronAPI && mail.uid) {
        // 使用 IMAP 删除
        console.log('[Mail] Deleting via IMAP...')
        const password = await ensureValidToken(account, accountStore)
        
        try {
          // 连接 IMAP
          await window.electronAPI.connectImap({
            email: account.email,
            password: password,
            imapHost: account.imapHost,
            imapPort: account.imapPort,
          })
          console.log('[Mail] IMAP connection established for deleting mail')
          
          // 打开文件夹
          await window.electronAPI.openImapFolder(mail.folder || 'INBOX')
          console.log(`[Mail] Folder opened: ${mail.folder || 'INBOX'}`)
          
          // 删除邮件
          await window.electronAPI.deleteImapMail(mail.uid)
          console.log('[Mail] Deleted via IMAP successfully')
          
          // 更新本地状态
          await updateMail(mailId, { folder: 'trash' })
        } catch (error) {
          console.error('[Mail] IMAP delete operation failed:', error)
          throw error
        } finally {
          // 总是断开连接
          await window.electronAPI.disconnectImap()
          console.log('[Mail] IMAP connection closed')
        }
      } else {
        // 只更新本地状态
        await updateMail(mailId, { folder: 'trash' })
      }
    } catch (error) {
      console.error('[Mail] Failed to delete mail:', error)
      throw error
    }
  }

  /**
   * 标记为已读/未读（同步到服务器）
   * @param {string} mailId - 邮件 ID
   * @param {boolean} read - 是否已读
   * @returns {Promise<void>}
   */
  async function markAsReadOnServer(mailId, read = true) {
    try {
      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      const mail = mails.value.find(m => m.id === mailId)
      if (!mail) {
        throw new Error('邮件不存在')
      }

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
        // 使用 Gmail API 标记
        console.log(`[Mail] Marking as ${read ? 'read' : 'unread'} via Gmail API...`)
        const accessToken = await ensureValidToken(account, accountStore)
        const { gmailApiService } = await import('@/services/gmail-api')
        
        if (read) {
          await gmailApiService.markAsRead(accessToken, mail.gmailId)
        } else {
          await gmailApiService.markAsUnread(accessToken, mail.gmailId)
        }
        
        console.log('[Mail] Marked via Gmail API successfully')
      } else if (window.electronAPI && mail.uid) {
        // 使用 IMAP 标记
        console.log(`[Mail] Marking as ${read ? 'read' : 'unread'} via IMAP...`)
        const password = await ensureValidToken(account, accountStore)
        
        try {
          // 连接 IMAP
          await window.electronAPI.connectImap({
            email: account.email,
            password: password,
            imapHost: account.imapHost,
            imapPort: account.imapPort,
          })
          console.log('[Mail] IMAP connection established for marking mail')
          
          // 打开文件夹
          await window.electronAPI.openImapFolder(mail.folder || 'INBOX')
          console.log(`[Mail] Folder opened: ${mail.folder || 'INBOX'}`)
          
          // 标记邮件
          if (read) {
            await window.electronAPI.markImapMailAsRead(mail.uid)
          }
          // Note: IMAP 没有直接的标记为未读的方法
          
          console.log('[Mail] Marked via IMAP successfully')
        } catch (error) {
          console.error('[Mail] IMAP operation failed:', error)
          throw error
        } finally {
          // 总是断开连接
          await window.electronAPI.disconnectImap()
          console.log('[Mail] IMAP connection closed')
        }
      }
      
      // 更新本地状态
      await updateMail(mailId, { read })
    } catch (error) {
      console.error('[Mail] Failed to mark mail:', error)
      throw error
    }
  }

  /**
   * 切换星标（同步到服务器）
   * @param {string} mailId - 邮件 ID
   * @returns {Promise<void>}
   */
  async function toggleFlagOnServer(mailId) {
    try {
      const mail = mails.value.find(m => m.id === mailId)
      if (!mail) {
        throw new Error('邮件不存在')
      }

      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      const newFlaggedState = !mail.flagged

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken && mail.gmailId) {
        // 使用 Gmail API 操作星标
        console.log(`[Mail] ${newFlaggedState ? 'Adding' : 'Removing'} star via Gmail API...`)
        const accessToken = await ensureValidToken(account, accountStore)
        const { gmailApiService } = await import('@/services/gmail-api')
        
        if (newFlaggedState) {
          await gmailApiService.addStar(accessToken, mail.gmailId)
        } else {
          await gmailApiService.removeStar(accessToken, mail.gmailId)
        }
        
        console.log('[Mail] Star toggled via Gmail API successfully')
      }
      // Note: IMAP 的星标操作可以后续添加
      
      // 更新本地状态
      await updateMail(mailId, { flagged: newFlaggedState })
    } catch (error) {
      console.error('[Mail] Failed to toggle flag:', error)
      throw error
    }
  }

  /**
   * 清空所有邮件
   * 用于账户删除或切换时重置状态
   */
  function clearAllMails() {
    console.log('[Mail] Clearing all mails...')
    mails.value = []
    selectedMailIds.value = []
  }

  /**
   * 重置文件夹列表到默认状态
   * 用于账户删除或切换时重置状态
   */
  function resetFolders() {
    console.log('[Mail] Resetting folders to default...')
    folders.value = [
      { id: 'inbox', name: '收件箱', icon: 'InboxOutlined', system: true },
      { id: 'sent', name: '已发送', icon: 'SendOutlined', system: true },
      { id: 'drafts', name: '草稿箱', icon: 'EditOutlined', system: true },
      { id: 'trash', name: '回收站', icon: 'DeleteOutlined', system: true },
      { id: 'starred', name: '星标邮件', icon: 'StarOutlined', system: true },
    ]
  }

  /**
   * 重置到收件箱
   * 用于账户删除或切换时重置当前文件夹
   */
  function resetToInbox() {
    console.log('[Mail] Resetting to inbox...')
    currentFolder.value = 'inbox'
  }

  /**
   * 完全重置邮件状态
   * 用于账户删除时清空所有数据并重置界面
   */
  function resetMailStore() {
    console.log('[Mail] Resetting mail store...')
    clearAllMails()
    resetFolders()
    resetToInbox()
    isSyncing.value = false
    lastSyncTime.value = null
    filter.value = {
      type: 'all',
      dateRange: null,
      limit: 50,
    }
    console.log('[Mail] Mail store reset complete')
  }

  /**
   * 批量标记为已读
   * @param {string[]} mailIds - 邮件ID列表
   * @returns {Promise<void>}
   */
  async function batchMarkAsRead(mailIds) {
    if (!mailIds || mailIds.length === 0) {
      return
    }

    try {
      console.log(`[Mail] Batch marking ${mailIds.length} mails as read...`)
      
      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken) {
        // 使用 Gmail API 批量标记（可以并发）
        console.log('[Mail] Batch marking via Gmail API...')
        const promises = mailIds.map(mailId => markAsReadOnServer(mailId, true))
        await Promise.all(promises)
      } else if (window.electronAPI) {
        // 使用 IMAP 批量标记 - 复用连接，串行执行
        console.log('[Mail] Batch marking via IMAP...')
        const password = await ensureValidToken(account, accountStore)
        let currentFolder = null
        
        try {
          // 连接 IMAP（一次连接用于所有操作）
          await window.electronAPI.connectImap({
            email: account.email,
            password: password,
            imapHost: account.imapHost,
            imapPort: account.imapPort,
          })
          console.log('[Mail] IMAP connection established for batch marking')
          
          // 按文件夹分组邮件
          const mailsByFolder = {}
          for (const mailId of mailIds) {
            const mail = mails.value.find(m => m.id === mailId)
            if (mail && mail.uid) {
              const folder = mail.folder || 'INBOX'
              if (!mailsByFolder[folder]) {
                mailsByFolder[folder] = []
              }
              mailsByFolder[folder].push(mail)
            }
          }
          
          // 逐个文件夹处理
          for (const [folder, folderMails] of Object.entries(mailsByFolder)) {
            // 打开文件夹（只在切换文件夹时打开）
            if (currentFolder !== folder) {
              await window.electronAPI.openImapFolder(folder)
              console.log(`[Mail] Folder opened: ${folder}`)
              currentFolder = folder
            }
            
            // 批量标记该文件夹的邮件
            for (const mail of folderMails) {
              try {
                await window.electronAPI.markImapMailAsRead(mail.uid)
                await updateMail(mail.id, { read: true })
                console.log(`[Mail] Marked mail ${mail.uid} as read`)
              } catch (error) {
                console.error(`[Mail] Failed to mark mail ${mail.uid}:`, error)
                // 继续处理其他邮件
              }
            }
          }
          
          console.log('[Mail] Batch marking completed')
        } catch (error) {
          console.error('[Mail] IMAP batch marking failed:', error)
          throw error
        } finally {
          // 总是断开连接
          await window.electronAPI.disconnectImap()
          console.log('[Mail] IMAP connection closed')
        }
      } else {
        // 只更新本地状态
        for (const mailId of mailIds) {
          await updateMail(mailId, { read: true })
        }
      }
      
      console.log('[Mail] Batch mark as read completed')
    } catch (error) {
      console.error('[Mail] Failed to batch mark as read:', error)
      throw error
    }
  }

  /**
   * 批量删除邮件
   * @param {string[]} mailIds - 邮件ID列表
   * @returns {Promise<void>}
   */
  async function batchDelete(mailIds) {
    if (!mailIds || mailIds.length === 0) {
      return
    }

    try {
      console.log(`[Mail] Batch deleting ${mailIds.length} mails...`)

      // 检查是否需要同步到服务器
      if (!appStore.settings.syncDeleteToServer) {
        console.log('[Mail] Delete sync disabled, only updating local state')
        // 只更新本地状态
        for (const mailId of mailIds) {
          await updateMail(mailId, { folder: 'trash' })
        }
        console.log('[Mail] Batch delete (local only) completed')
        return
      }

      const account = accountStore.currentAccount
      if (!account) {
        throw new Error('请先选择账户')
      }

      // 检测是否为 Gmail 账户
      const isGmail = account.provider === 'gmail' || 
                      account.imapHost?.includes('gmail.com') ||
                      account.email?.endsWith('@gmail.com')

      if (isGmail && account.oauth2 && account.accessToken) {
        // 使用 Gmail API 批量删除（可以并发）
        console.log('[Mail] Batch deleting via Gmail API...')
        const promises = mailIds.map(mailId => deleteMailFromServer(mailId))
        await Promise.all(promises)
      } else if (window.electronAPI) {
        // 使用 IMAP 批量删除 - 复用连接，串行执行
        console.log('[Mail] Batch deleting via IMAP...')
        const password = await ensureValidToken(account, accountStore)
        let currentFolder = null
        
        try {
          // 连接 IMAP（一次连接用于所有操作）
          await window.electronAPI.connectImap({
            email: account.email,
            password: password,
            imapHost: account.imapHost,
            imapPort: account.imapPort,
          })
          console.log('[Mail] IMAP connection established for batch deleting')
          
          // 按文件夹分组邮件
          const mailsByFolder = {}
          for (const mailId of mailIds) {
            const mail = mails.value.find(m => m.id === mailId)
            if (mail && mail.uid) {
              const folder = mail.folder || 'INBOX'
              if (!mailsByFolder[folder]) {
                mailsByFolder[folder] = []
              }
              mailsByFolder[folder].push(mail)
            }
          }
          
          // 逐个文件夹处理
          for (const [folder, folderMails] of Object.entries(mailsByFolder)) {
            // 打开文件夹（只在切换文件夹时打开）
            if (currentFolder !== folder) {
              await window.electronAPI.openImapFolder(folder)
              console.log(`[Mail] Folder opened: ${folder}`)
              currentFolder = folder
            }
            
            // 批量删除该文件夹的邮件
            for (const mail of folderMails) {
              try {
                await window.electronAPI.deleteImapMail(mail.uid)
                await updateMail(mail.id, { folder: 'trash' })
                console.log(`[Mail] Deleted mail ${mail.uid}`)
              } catch (error) {
                console.error(`[Mail] Failed to delete mail ${mail.uid}:`, error)
                // 继续处理其他邮件
              }
            }
          }
          
          console.log('[Mail] Batch deleting completed')
        } catch (error) {
          console.error('[Mail] IMAP batch deleting failed:', error)
          throw error
        } finally {
          // 总是断开连接
          await window.electronAPI.disconnectImap()
          console.log('[Mail] IMAP connection closed')
        }
      } else {
        // 只更新本地状态
        for (const mailId of mailIds) {
          await updateMail(mailId, { folder: 'trash' })
        }
      }
      
      console.log('[Mail] Batch delete completed')
    } catch (error) {
      console.error('[Mail] Failed to batch delete:', error)
      throw error
    }
  }

  /**
   * 全选当前文件夹的邮件
   */
  function selectAll() {
    selectedMailIds.value = currentMails.value.map(m => m.id)
  }

  /**
   * 反选
   */
  function invertSelection() {
    const currentIds = currentMails.value.map(m => m.id)
    selectedMailIds.value = currentIds.filter(id => !selectedMailIds.value.includes(id))
  }

  /**
   * 导出邮件为CSV和ZIP
   * @param {string[]} mailIds - 要导出的邮件ID列表（如果为空则导出所有已选邮件）
   * @returns {Promise<Object>} 导出结果
   */
  async function exportMails(mailIds = null) {
    try {
      // 确定要导出的邮件ID
      const idsToExport = mailIds || selectedMailIds.value

      if (!idsToExport || idsToExport.length === 0) {
        throw new Error('请先选择要导出的邮件')
      }

      console.log(`[Mail] Exporting ${idsToExport.length} mails...`)

      // 获取邮件完整数据
      const mailsToExport = mails.value.filter(m => idsToExport.includes(m.id))

      if (mailsToExport.length === 0) {
        throw new Error('未找到要导出的邮件')
      }

      // 获取所有账户信息（用于获取附件）
      const accounts = accountStore.accounts || []

      // 转换为普通对象（去除响应式代理），避免 IPC 序列化问题
      const plainMails = JSON.parse(JSON.stringify(mailsToExport))
      const plainAccounts = JSON.parse(JSON.stringify(accounts))

      // 调用主进程导出API
      const result = await window.electronAPI.exportMails(plainMails, plainAccounts)

      if (result.success) {
        console.log('[Mail] Export completed successfully')
        return result
      } else if (result.canceled) {
        console.log('[Mail] Export canceled by user')
        return result
      } else {
        throw new Error(result.error || '导出失败')
      }
    } catch (error) {
      console.error('[Mail] Export failed:', error)
      throw error
    }
  }

  return {
    mails,
    currentFolder,
    folders,
    isSyncing,
    lastSyncTime,
    currentMails,
    unreadCount,
    selectedMailIds,
    filter,
    loadMails,
    fetchMailsFromServer,
    addMail,
    updateMail,
    deleteMail,
    permanentlyDeleteMail,
    markAsRead,
    toggleFlag,
    switchFolder,
    updateFilter,
    selectMail,
    unselectMail,
    clearSelection,
    syncServerFolders,
    loadFolders,
    createFolder,
    deleteFolder,
    moveMailToFolder,
    // Gmail API 操作方法
    sendMail,
    replyMail,
    deleteMailFromServer,
    markAsReadOnServer,
    toggleFlagOnServer,
    // 重置方法
    clearAllMails,
    resetFolders,
    resetToInbox,
    resetMailStore,
    // 批量操作方法
    batchMarkAsRead,
    batchDelete,
    selectAll,
    invertSelection,
    // 导出方法
    exportMails,
  }
})
