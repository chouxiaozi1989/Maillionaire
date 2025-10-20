/**
 * 本地文件存储服务
 * 支持Electron和浏览器环境
 */

class StorageService {
  constructor() {
    this.isElectron = !!window.electronAPI
    this.dataPath = this.isElectron ? '' : 'maillionaire_data'
  }
  
  /**
   * 读取JSON文件
   */
  async readJSON(filename) {
    try {
      if (this.isElectron) {
        // Electron环境：使用文件系统
        const data = await window.electronAPI.readFile(filename)
        return data ? JSON.parse(data) : null
      } else {
        // 浏览器环境：使用localStorage
        const key = `${this.dataPath}_${filename}`
        const data = localStorage.getItem(key)
        return data ? JSON.parse(data) : null
      }
    } catch (error) {
      console.error(`Failed to read ${filename}:`, error)
      return null
    }
  }
  
  /**
   * 写入JSON文件
   */
  async writeJSON(filename, data) {
    try {
      const jsonData = JSON.stringify(data, null, 2)
      
      if (this.isElectron) {
        // Electron环境：使用文件系统
        await window.electronAPI.writeFile(filename, jsonData)
      } else {
        // 浏览器环境：使用localStorage
        const key = `${this.dataPath}_${filename}`
        localStorage.setItem(key, jsonData)
      }
    } catch (error) {
      console.error(`Failed to write ${filename}:`, error)
      throw error
    }
  }
  
  /**
   * 删除文件
   */
  async deleteFile(filename) {
    try {
      if (this.isElectron) {
        await window.electronAPI.deleteFile(filename)
      } else {
        const key = `${this.dataPath}_${filename}`
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Failed to delete ${filename}:`, error)
      throw error
    }
  }
  
  /**
   * 加载账户列表
   */
  async loadAccounts() {
    return await this.readJSON('accounts/accounts.json')
  }
  
  /**
   * 保存账户列表
   */
  async saveAccounts(accounts) {
    await this.writeJSON('accounts/accounts.json', accounts)
  }
  
  /**
   * 加载邮件列表
   */
  async loadMails(accountId, folder) {
    const filename = `emails/${accountId}/${folder}.json`
    return await this.readJSON(filename)
  }
  
  /**
   * 保存邮件列表
   */
  async saveMails(accountId, folder, mails) {
    const filename = `emails/${accountId}/${folder}.json`
    await this.writeJSON(filename, mails)
  }
  
  /**
   * 加载通讯录
   */
  async loadContacts() {
    return await this.readJSON('contacts/contacts.json')
  }
  
  /**
   * 保存通讯录
   */
  async saveContacts(contacts) {
    await this.writeJSON('contacts/contacts.json', contacts)
  }
  
  /**
   * 加载邮件模板
   */
  async loadTemplates() {
    return await this.readJSON('templates/templates.json')
  }
  
  /**
   * 保存邮件模板
   */
  async saveTemplates(templates) {
    await this.writeJSON('templates/templates.json', templates)
  }
  
  /**
   * 加载签名
   */
  async loadSignatures() {
    return await this.readJSON('signatures/signatures.json')
  }
  
  /**
   * 保存签名
   */
  async saveSignatures(signatures) {
    await this.writeJSON('signatures/signatures.json', signatures)
  }
  
  /**
   * 加载应用配置
   */
  async loadConfig() {
    return await this.readJSON('settings/config.json')
  }
  
  /**
   * 保存应用配置
   */
  async saveConfig(config) {
    await this.writeJSON('settings/config.json', config)
  }

  /**
   * 删除账户的所有数据
   * 包括邮件、文件夹等
   */
  async deleteAccountData(accountId) {
    try {
      // 删除所有文件夹的邮件
      const folders = ['inbox', 'sent', 'drafts', 'trash', 'starred']
      
      for (const folder of folders) {
        const filename = `emails/${accountId}/${folder}.json`
        try {
          await this.deleteFile(filename)
          console.log(`[Storage] Deleted ${filename}`)
        } catch (error) {
          // 忽略不存在的文件
          if (error.code !== 'ENOENT') {
            console.error(`[Storage] Failed to delete ${filename}:`, error)
          }
        }
      }
      
      // 如果是 Electron 环境，删除整个账户文件夹
      if (this.isElectron) {
        // 注意：electronAPI 目前不支持删除文件夹，只能删除文件
        // 如果需要，可以在主进程添加 deleteFolder API
        console.log(`[Storage] Account ${accountId} data deletion completed`)
      }
      
      return true
    } catch (error) {
      console.error('[Storage] Failed to delete account data:', error)
      throw error
    }
  }
}

export const storageService = new StorageService()
