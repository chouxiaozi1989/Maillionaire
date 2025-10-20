import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storageService } from '@/services/storage'
import { imapService } from '@/services/imap'
import { smtpService } from '@/services/smtp'

/**
 * 账户管理状态
 */
export const useAccountStore = defineStore('account', () => {
  // 所有账户列表
  const accounts = ref([])
  
  // 当前选中的账户
  const currentAccountId = ref(null)
  
  /**
   * 当前账户对象
   */
  const currentAccount = computed(() => {
    return accounts.value.find(acc => acc.id === currentAccountId.value)
  })
  
  /**
   * 加载所有账户
   */
  async function loadAccounts() {
    try {
      const data = await storageService.loadAccounts()
      accounts.value = data || []
      
      // 如果有账户，默认选中第一个
      if (accounts.value.length > 0 && !currentAccountId.value) {
        currentAccountId.value = accounts.value[0].id
      }
    } catch (error) {
      console.error('Failed to load accounts:', error)
      accounts.value = []
    }
  }
  
  /**
   * 验证账户连接
   * 测试 IMAP 和 SMTP 连接是否正常
   */
  async function verifyAccount(account) {
    try {
      const results = {
        imap: false,
        smtp: false,
        errors: [],
      }
      
      // 如果是 OAuth2 账户，检查是否为测试模式
      if (account.oauth2 && account.testMode) {
        console.log('[Account] OAuth2 test mode - skipping verification')
        return {
          imap: true,
          smtp: true,
          testMode: true,
        }
      }
      
      // 验证 IMAP 连接
      try {
        await imapService.connect({
          email: account.email,
          password: account.password || account.accessToken,
          imapHost: account.imapHost,
          imapPort: account.imapPort,
        })
        results.imap = true
        console.log('[Account] IMAP connection verified')
        
        // 连接成功后断开
        await imapService.disconnect()
      } catch (error) {
        console.error('[Account] IMAP verification failed:', error)
        results.errors.push(`IMAP: ${error.message}`)
      }
      
      // 验证 SMTP 连接
      try {
        await smtpService.verify({
          email: account.email,
          password: account.password || account.accessToken,
          smtpHost: account.smtpHost,
          smtpPort: account.smtpPort,
        })
        results.smtp = true
        console.log('[Account] SMTP connection verified')
      } catch (error) {
        console.error('[Account] SMTP verification failed:', error)
        results.errors.push(`SMTP: ${error.message}`)
      }
      
      return results
    } catch (error) {
      console.error('[Account] Verification failed:', error)
      throw error
    }
  }
  
  /**
   * 添加账户（带连接验证）
   */
  async function addAccountWithVerify(account, skipVerify = false) {
    try {
      const newAccount = {
        id: Date.now().toString(),
        ...account,
        connected: false,
        createdAt: new Date().toISOString(),
      }
      
      // 如果不跳过验证，尝试连接
      if (!skipVerify) {
        const verifyResult = await verifyAccount(newAccount)
        newAccount.connected = verifyResult.imap && verifyResult.smtp
        newAccount.verifyResult = verifyResult
        newAccount.lastVerifiedAt = new Date().toISOString()
      }
      
      accounts.value.push(newAccount)
      await saveAccounts()
      
      return newAccount
    } catch (error) {
      console.error('Failed to add account:', error)
      throw error
    }
  }
  
  /**
   * 添加账户（兼容方法，默认不验证）
   */
  async function addAccount(account) {
    return await addAccountWithVerify(account, true)
  }
  
  /**
   * 更新账户
   */
  async function updateAccount(accountId, updates) {
    try {
      const index = accounts.value.findIndex(acc => acc.id === accountId)
      if (index !== -1) {
        accounts.value[index] = {
          ...accounts.value[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
        await saveAccounts()
      }
    } catch (error) {
      console.error('Failed to update account:', error)
      throw error
    }
  }
  
  /**
   * 删除账户
   */
  async function deleteAccount(accountId) {
    try {
      accounts.value = accounts.value.filter(acc => acc.id !== accountId)
      
      // 如果删除的是当前账户，切换到第一个账户
      if (currentAccountId.value === accountId) {
        currentAccountId.value = accounts.value.length > 0 
          ? accounts.value[0].id 
          : null
      }
      
      await saveAccounts()
    } catch (error) {
      console.error('Failed to delete account:', error)
      throw error
    }
  }

  /**
   * 断开账户连接
   */
  async function disconnectAccount(accountId) {
    try {
      await updateAccount(accountId, {
        connected: false,
        verifyResult: null,
      })
    } catch (error) {
      console.error('Failed to disconnect account:', error)
      throw error
    }
  }

  /**
   * 同步账户
   * 重新验证账户连接并更新状态
   */
  async function syncAccount(accountId) {
    try {
      const account = accounts.value.find(acc => acc.id === accountId)
      if (!account) {
        throw new Error('账户不存在')
      }
      
      // 验证连接
      const verifyResult = await verifyAccount(account)
      
      // 更新账户信息
      await updateAccount(accountId, {
        connected: verifyResult.imap && verifyResult.smtp,
        verifyResult,
        lastSyncedAt: new Date().toISOString(),
      })
      
      return verifyResult
    } catch (error) {
      console.error('[Account] Sync failed:', error)
      throw error
    }
  }
  
  /**
   * 同步所有账户
   */
  async function syncAllAccounts() {
    try {
      const results = []
      
      for (const account of accounts.value) {
        try {
          const result = await syncAccount(account.id)
          results.push({
            accountId: account.id,
            email: account.email,
            success: result.imap && result.smtp,
            result,
          })
        } catch (error) {
          results.push({
            accountId: account.id,
            email: account.email,
            success: false,
            error: error.message,
          })
        }
      }
      
      return results
    } catch (error) {
      console.error('[Account] Sync all failed:', error)
      throw error
    }
  }
  
  /**
   * 切换当前账户
   */
  function switchAccount(accountId) {
    if (accounts.value.find(acc => acc.id === accountId)) {
      currentAccountId.value = accountId
      localStorage.setItem('currentAccountId', accountId)
    }
  }
  
  /**
   * 保存账户列表
   */
  async function saveAccounts() {
    try {
      await storageService.saveAccounts(accounts.value)
    } catch (error) {
      console.error('Failed to save accounts:', error)
      throw error
    }
  }
  
  /**
   * 登出
   */
  function logout() {
    currentAccountId.value = null
    localStorage.removeItem('currentAccountId')
  }
  
  return {
    accounts,
    currentAccountId,
    currentAccount,
    loadAccounts,
    addAccount,
    addAccountWithVerify,
    verifyAccount,
    syncAccount,
    syncAllAccounts,
    updateAccount,
    deleteAccount,
    disconnectAccount,
    switchAccount,
    logout,
  }
})
