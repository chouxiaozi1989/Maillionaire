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
      
      // TODO: 实际从 IMAP 服务器获取文件夹
      // const imapFolders = await imapService.syncFolders()
      
      // 模拟服务器文件夹
      const serverFolders = [
        { id: 'work', name: '工作邮件', icon: 'FolderOutlined', system: false },
        { id: 'personal', name: '个人邮件', icon: 'FolderOutlined', system: false },
      ]
      
      // 合并服务器文件夹到本地
      serverFolders.forEach(serverFolder => {
        const exists = folders.value.find(f => f.id === serverFolder.id)
        if (!exists) {
          folders.value.push(serverFolder)
        }
      })
      
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
