/**
 * IMAP邮件服务（渲染进程版本）
 * 通过 IPC 调用主进程的 IMAP 功能
 */

class ImapService {
  /**
   * 检查是否在 Electron 环境
   */
  get isElectron() {
    return !!window.electronAPI
  }
  
  /**
   * 连接到IMAP服务器
   */
  async connect(config) {
    if (this.isElectron) {
      // Electron 环境：通过 IPC 调用
      return await window.electronAPI.connectImap(config)
    } else {
      // 浏览器环境：返回模拟结果
      console.warn('[IMAP] Browser mode: connection skipped')
      return true
    }
  }
  
  /**
   * 断开连接
   */
  async disconnect() {
    if (this.isElectron) {
      return await window.electronAPI.disconnectImap()
    }
  }
  
  /**
   * 获取文件夹列表
   */
  async getFolders() {
    if (this.isElectron) {
      return await window.electronAPI.getImapFolders()
    } else {
      // 浏览器环境：返回模拟数据
      return {
        INBOX: { attribs: [], delimiter: '/', children: null },
        Sent: { attribs: [], delimiter: '/', children: null },
        Drafts: { attribs: [], delimiter: '/', children: null },
        Trash: { attribs: [], delimiter: '/', children: null },
      }
    }
  }
  
  /**
   * 打开文件夹
   */
  async openFolder(folderName) {
    if (this.isElectron) {
      return await window.electronAPI.openImapFolder(folderName)
    } else {
      return { messages: { total: 0 } }
    }
  }
  
  /**
   * 搜索邮件
   */
  async searchMails(criteria) {
    if (this.isElectron) {
      return await window.electronAPI.searchImapMails(criteria)
    } else {
      return []
    }
  }
  
  /**
   * 获取邮件
   */
  async fetchMails(uids, options = {}) {
    if (this.isElectron) {
      return await window.electronAPI.fetchImapMails(uids, options)
    } else {
      // 返回模拟邮件数据
      return []
    }
  }
  
  /**
   * 标记邮件为已读
   */
  async markAsRead(uid) {
    if (this.isElectron) {
      return await window.electronAPI.markImapMailAsRead(uid)
    } else {
      return true
    }
  }
  
  /**
   * 删除邮件
   */
  async deleteMail(uid) {
    if (this.isElectron) {
      return await window.electronAPI.deleteImapMail(uid)
    } else {
      return true
    }
  }
  
  /**
   * 移动邮件到文件夹
   */
  async moveMail(uid, targetFolder) {
    if (this.isElectron) {
      return await window.electronAPI.moveImapMail(uid, targetFolder)
    } else {
      return true
    }
  }

  /**
   * 获取服务器文件夹列表（扁平化）
   */
  async getServerFolders() {
    if (this.isElectron) {
      return await window.electronAPI.getServerFolders()
    } else {
      return [
        { name: 'INBOX', path: 'INBOX', delimiter: '/', attributes: [] },
        { name: 'Sent', path: 'Sent', delimiter: '/', attributes: [] },
        { name: 'Drafts', path: 'Drafts', delimiter: '/', attributes: [] },
        { name: 'Trash', path: 'Trash', delimiter: '/', attributes: [] },
      ]
    }
  }

  /**
   * 创建文件夹
   */
  async createFolder(folderName) {
    if (this.isElectron) {
      return await window.electronAPI.createImapFolder(folderName)
    } else {
      return true
    }
  }

  /**
   * 删除文件夹
   */
  async deleteFolder(folderName) {
    if (this.isElectron) {
      return await window.electronAPI.deleteImapFolder(folderName)
    } else {
      return true
    }
  }

  /**
   * 重命名文件夹
   */
  async renameFolder(oldName, newName) {
    if (this.isElectron) {
      return await window.electronAPI.renameImapFolder(oldName, newName)
    } else {
      return true
    }
  }

  /**
   * 同步文件夹结构
   */
  async syncFolders() {
    return await this.getServerFolders()
  }

  /**
   * 复制邮件到文件夹
   */
  async copyMail(uid, targetFolder) {
    if (this.isElectron) {
      return await window.electronAPI.copyImapMail(uid, targetFolder)
    } else {
      return true
    }
  }
}

export const imapService = new ImapService()
