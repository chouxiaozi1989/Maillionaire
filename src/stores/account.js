import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storageService } from '@/services/storage'
import { imapService } from '@/services/imap'
import { smtpService } from '@/services/smtp'
import proxyConfig from '@/config/proxy'

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

      // 如果是 OAuth2 账户，跳过验证
      // OAuth2 的 IMAP/SMTP 认证需要在 Electron 主进程中实现 XOAUTH2 机制
      if (account.oauth2) {
        console.log('[Account] OAuth2 account - skipping IMAP/SMTP verification')
        console.log('[Account] OAuth2 authentication already validated the account')
        return {
          imap: true,
          smtp: true,
          oauth2: true,
          message: 'OAuth2 认证已验证账户有效性',
        }
      }

      // 获取账户的有效代理配置
      const effectiveProxy = proxyConfig.getEffectiveProxyConfig(account)

      if (effectiveProxy) {
        console.log('[Account] Using proxy:', effectiveProxy.protocol + '://' + effectiveProxy.host + ':' + effectiveProxy.port)
        if (account.proxySettings?.useIndependent) {
          console.log('[Account] Using independent proxy settings')
        } else {
          console.log('[Account] Using global proxy settings')
        }
        if (window.electronAPI && window.electronAPI.setProxyConfig) {
          await window.electronAPI.setProxyConfig(effectiveProxy)
        }
      } else {
        console.log('[Account] No proxy will be used (direct connection)')
        if (account.proxySettings?.useIndependent) {
          console.log('[Account] Independent proxy settings disabled proxy')
        }
        // 清除代理设置，使用直接连接
        if (window.electronAPI && window.electronAPI.setProxyConfig) {
          await window.electronAPI.setProxyConfig({ enabled: false })
        }
      }

      // 验证 IMAP 连接（仅用于 IMAP/SMTP 账户）
      try {
        await imapService.connect({
          email: account.email,
          password: account.password,
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

      // 验证 SMTP 连接（仅用于 IMAP/SMTP 账户）
      try {
        await smtpService.verify({
          email: account.email,
          password: account.password,
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
      const account = accounts.value.find(acc => acc.id === accountId)
      if (!account) {
        throw new Error('账户不存在')
      }

      console.log(`[Account] Deleting account ${account.email}...`)

      // 1. 删除账户的所有本地数据（邮件、文件夹等）
      console.log(`[Account] Deleting data for account ${account.email}...`)
      await storageService.deleteAccountData(accountId)
      
      // 2. 从账户列表中移除
      accounts.value = accounts.value.filter(acc => acc.id !== accountId)
      
      // 3. 如果删除的是当前账户，需要重置界面
      const isDeletingCurrentAccount = currentAccountId.value === accountId
      
      if (isDeletingCurrentAccount) {
        console.log('[Account] Deleting current account, resetting UI...')
        
        // 3.1 清空邮件 store 的数据
        const { useMailStore } = await import('./mail')
        const mailStore = useMailStore()
        mailStore.resetMailStore()
        
        // 3.2 切换到第一个账户（如果还有）
        if (accounts.value.length > 0) {
          currentAccountId.value = accounts.value[0].id
          localStorage.setItem('currentAccountId', currentAccountId.value)
          
          // 加载新账户的邮件
          await mailStore.loadMails('inbox')
          await mailStore.loadFolders()
        } else {
          // 没有账户了，清除当前账户 ID
          currentAccountId.value = null
          localStorage.removeItem('currentAccountId')
        }
      }
      
      // 4. 保存更新后的账户列表
      await saveAccounts()
      
      console.log(`[Account] Account ${account.email} deleted successfully`)
      return { isDeletingCurrentAccount }
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
