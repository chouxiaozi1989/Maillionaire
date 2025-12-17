import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storageService } from '@/services/storage'

/**
 * 邮件模板管理状态
 */
export const useTemplateStore = defineStore('template', () => {
  // 所有模板列表
  const templates = ref([])
  
  /**
   * 加载所有模板
   */
  async function loadTemplates() {
    try {
      const data = await storageService.readJSON('templates.json')
      templates.value = data || []
    } catch (error) {
      console.error('Failed to load templates:', error)
      templates.value = []
    }
  }
  
  /**
   * 添加模板
   */
  async function addTemplate(template) {
    try {
      const newTemplate = {
        id: Date.now().toString(),
        name: template.name,
        subject: template.subject || '',
        body: template.body || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      templates.value.push(newTemplate)
      await saveTemplates()
      
      return newTemplate
    } catch (error) {
      console.error('Failed to add template:', error)
      throw error
    }
  }
  
  /**
   * 更新模板
   */
  async function updateTemplate(templateId, updates) {
    try {
      const index = templates.value.findIndex(t => t.id === templateId)
      if (index !== -1) {
        templates.value[index] = {
          ...templates.value[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
        await saveTemplates()
      }
    } catch (error) {
      console.error('Failed to update template:', error)
      throw error
    }
  }
  
  /**
   * 删除模板
   */
  async function deleteTemplate(templateId) {
    try {
      templates.value = templates.value.filter(t => t.id !== templateId)
      await saveTemplates()
    } catch (error) {
      console.error('Failed to delete template:', error)
      throw error
    }
  }
  
  /**
   * 获取单个模板
   */
  function getTemplate(templateId) {
    return templates.value.find(t => t.id === templateId)
  }
  
  /**
   * 保存模板列表
   */
  async function saveTemplates() {
    try {
      await storageService.writeJSON('templates.json', templates.value)
    } catch (error) {
      console.error('Failed to save templates:', error)
      throw error
    }
  }
  
  return {
    templates,
    loadTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
  }
})
