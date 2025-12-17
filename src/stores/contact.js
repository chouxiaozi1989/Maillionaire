import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storageService } from '@/services/storage'

/**
 * 通讯录管理状态
 */
export const useContactStore = defineStore('contact', () => {
  // 联系人列表
  const contacts = ref([])
  
  // 当前分组
  const currentGroup = ref('all')
  
  // 分组列表
  const groups = ref([
    { id: 'all', name: '全部联系人', count: 0 },
    { id: 'colleagues', name: '同事', count: 0 },
    { id: 'clients', name: '客户', count: 0 },
    { id: 'friends', name: '朋友', count: 0 },
    { id: 'favorites', name: '常用联系人', count: 0 },
  ])
  
  /**
   * 加载联系人
   */
  async function loadContacts() {
    try {
      const data = await storageService.loadContacts()
      contacts.value = data || []
      updateGroupCounts()
    } catch (error) {
      console.error('Failed to load contacts:', error)
      contacts.value = []
    }
  }
  
  /**
   * 添加联系人
   */
  async function addContact(contact) {
    try {
      const newContact = {
        id: Date.now().toString(),
        ...contact,
        createdAt: new Date().toISOString(),
      }
      
      contacts.value.push(newContact)
      await saveContacts()
      updateGroupCounts()
      
      return newContact
    } catch (error) {
      console.error('Failed to add contact:', error)
      throw error
    }
  }
  
  /**
   * 更新联系人
   */
  async function updateContact(contactId, updates) {
    try {
      const index = contacts.value.findIndex(c => c.id === contactId)
      if (index !== -1) {
        contacts.value[index] = {
          ...contacts.value[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
        await saveContacts()
        updateGroupCounts()
      }
    } catch (error) {
      console.error('Failed to update contact:', error)
      throw error
    }
  }
  
  /**
   * 删除联系人
   */
  async function deleteContact(contactId) {
    try {
      contacts.value = contacts.value.filter(c => c.id !== contactId)
      await saveContacts()
      updateGroupCounts()
    } catch (error) {
      console.error('Failed to delete contact:', error)
      throw error
    }
  }
  
  /**
   * 搜索联系人
   */
  function searchContacts(keyword) {
    if (!keyword) return contacts.value
    
    const lowerKeyword = keyword.toLowerCase()
    return contacts.value.filter(contact => 
      contact.name.toLowerCase().includes(lowerKeyword) ||
      contact.email.toLowerCase().includes(lowerKeyword) ||
      (contact.phone && contact.phone.includes(keyword))
    )
  }
  
  /**
   * 按分组获取联系人
   */
  function getContactsByGroup(groupId) {
    if (groupId === 'all') {
      return contacts.value
    } else if (groupId === 'favorites') {
      return contacts.value.filter(c => c.favorite)
    } else {
      return contacts.value.filter(c => c.group === groupId)
    }
  }
  
  /**
   * 更新分组统计
   */
  function updateGroupCounts() {
    groups.value.forEach(group => {
      group.count = getContactsByGroup(group.id).length
    })
  }
  
  /**
   * 保存联系人
   */
  async function saveContacts() {
    try {
      await storageService.saveContacts(contacts.value)
    } catch (error) {
      console.error('Failed to save contacts:', error)
      throw error
    }
  }
  
  /**
   * 导入联系人（CSV）
   */
  async function importContacts(csvData) {
    // TODO: 实现CSV解析和导入逻辑
    console.log('Import contacts:', csvData)
  }
  
  /**
   * 导出联系人（CSV）
   */
  function exportContacts() {
    // TODO: 实现CSV导出逻辑
    console.log('Export contacts')
  }
  
  return {
    contacts,
    currentGroup,
    groups,
    loadContacts,
    addContact,
    updateContact,
    deleteContact,
    searchContacts,
    getContactsByGroup,
    importContacts,
    exportContacts,
  }
})
