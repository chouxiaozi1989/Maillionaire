import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storageService } from '@/services/storage'
import { useAccountStore } from './account'

/**
 * 邮件管理状态
 */
export const useMailStore = defineStore('mail', () => {
  const accountStore = useAccountStore()
  
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
    let filtered = mails.value.filter(mail => mail.folder === currentFolder.value)
    
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
   */
  async function loadMails(folder = 'inbox') {
    try {
      const accountId = accountStore.currentAccountId
      if (!accountId) return
      
      const data = await storageService.loadMails(accountId, folder)
      mails.value = data || []
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

      // 1. 连接 IMAP
      await window.electronAPI.connectImap({
        email: account.email,
        password: account.password || account.accessToken,
        imapHost: account.imapHost,
        imapPort: account.imapPort,
      })

      // 2. 打开文件夹
      await window.electronAPI.openImapFolder(folderName)

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
      const uids = await window.electronAPI.searchImapMails(criteria)
      console.log(`[Mail] Found ${uids.length} mails`)

      if (uids.length === 0) {
        await window.electronAPI.disconnectImap()
        return []
      }

      // 5. 限制数量（取最新的）
      const limit = options.limit || 50
      const fetchUids = uids.slice(-limit)

      // 6. 获取并解析邮件
      const fetchedMails = await window.electronAPI.fetchAndParseImapMails(fetchUids)
      console.log(`[Mail] Fetched ${fetchedMails.length} mails`)

      // 7. 转换为应用数据格式
      const newMails = fetchedMails.map(mail => ({
        id: `${accountStore.currentAccountId}_${mail.uid}_${Date.now()}`,
        uid: mail.uid,
        accountId: accountStore.currentAccountId,
        folder: currentFolder.value,
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
      console.error('[Mail] Failed to fetch mails:', error)
      
      // 确保断开连接
      if (window.electronAPI) {
        try {
          await window.electronAPI.disconnectImap()
        } catch (e) {
          // 忽略断开错误
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
   */
  async function deleteMail(mailId) {
    try {
      await updateMail(mailId, { folder: 'trash' })
    } catch (error) {
      console.error('Failed to delete mail:', error)
      throw error
    }
  }
  
  /**
   * 永久删除邮件
   */
  async function permanentlyDeleteMail(mailId) {
    try {
      mails.value = mails.value.filter(mail => mail.id !== mailId)
      await saveMails()
    } catch (error) {
      console.error('Failed to permanently delete mail:', error)
      throw error
    }
  }
  
  /**
   * 标记为已读/未读
   */
  async function markAsRead(mailId, read = true) {
    await updateMail(mailId, { read })
  }
  
  /**
   * 切换星标
   */
  async function toggleFlag(mailId) {
    const mail = mails.value.find(m => m.id === mailId)
    if (mail) {
      await updateMail(mailId, { flagged: !mail.flagged })
    }
  }
  
  /**
   * 切换文件夹
   */
  async function switchFolder(folder) {
    currentFolder.value = folder
    await loadMails(folder)
  }
  
  /**
   * 更新筛选条件
   */
  function updateFilter(newFilter) {
    filter.value = { ...filter.value, ...newFilter }
  }
  
  /**
   * 保存邮件列表
   */
  async function saveMails() {
    try {
      const accountId = accountStore.currentAccountId
      if (!accountId) return
      
      await storageService.saveMails(accountId, currentFolder.value, mails.value)
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
   * 从 IMAP 服务器获取文件夹列表并与本地合并
   */
  async function syncServerFolders() {
    try {
      isSyncing.value = true
      const account = accountStore.currentAccount
      
      if (!account) {
        throw new Error('请先选择账户')
      }

      // 如果是 Electron 环境，从真实 IMAP 服务器获取文件夹
      if (window.electronAPI) {
        try {
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

          // 映射常见文件夹名称到系统文件夹
          const folderMapping = {
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
          }

          // 处理服务器文件夹
          serverFolders.forEach(serverFolder => {
            const mappedId = folderMapping[serverFolder.name] || folderMapping[serverFolder.path]
            
            if (mappedId) {
              // 更新系统文件夹的服务器路径
              const folder = folders.value.find(f => f.id === mappedId)
              if (folder) {
                folder.serverPath = serverFolder.path
                folder.delimiter = serverFolder.delimiter
              }
            } else {
              // 自定义文件夹，添加到列表
              const exists = folders.value.find(f => f.serverPath === serverFolder.path)
              if (!exists) {
                folders.value.push({
                  id: `server_${serverFolder.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                  name: serverFolder.name,
                  serverPath: serverFolder.path,
                  delimiter: serverFolder.delimiter,
                  icon: 'FolderOutlined',
                  system: false,
                })
              }
            }
          })

          // 断开连接
          await window.electronAPI.disconnectImap()

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
        
        serverFolders.forEach(serverFolder => {
          const exists = folders.value.find(f => f.id === serverFolder.id)
          if (!exists) {
            folders.value.push(serverFolder)
          }
        })
      }
      
      lastSyncTime.value = new Date().toISOString()
      await storageService.writeJSON('folders.json', {
        folders: folders.value,
        lastSyncTime: lastSyncTime.value,
      })
      
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
      const data = await storageService.readJSON('folders.json')
      if (data) {
        folders.value = data.folders || folders.value
        lastSyncTime.value = data.lastSyncTime
      }
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  }

  /**
   * 创建自定义文件夹
   */
  async function createFolder(folderName) {
    try {
      const newFolder = {
        id: `custom_${Date.now()}`,
        name: folderName,
        icon: 'FolderOutlined',
        system: false,
        createdAt: new Date().toISOString(),
      }
      
      folders.value.push(newFolder)
      
      await storageService.writeJSON('folders.json', {
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
      const folder = folders.value.find(f => f.id === folderId)
      if (!folder || folder.system) {
        throw new Error('无法删除系统文件夹')
      }
      
      folders.value = folders.value.filter(f => f.id !== folderId)
      
      await storageService.writeJSON('folders.json', {
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
  }
})
