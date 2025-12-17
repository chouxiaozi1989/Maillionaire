import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storageService } from '@/services/storage'

/**
 * 邮件签名管理状态
 */
export const useSignatureStore = defineStore('signature', () => {
  // 所有签名列表
  const signatures = ref([])
  
  // 默认签名ID
  const defaultSignatureId = ref(null)
  
  /**
   * 加载所有签名
   */
  async function loadSignatures() {
    try {
      const data = await storageService.readJSON('signatures.json')
      signatures.value = data?.signatures || []
      defaultSignatureId.value = data?.defaultSignatureId || null
    } catch (error) {
      console.error('Failed to load signatures:', error)
      signatures.value = []
      defaultSignatureId.value = null
    }
  }
  
  /**
   * 添加签名
   */
  async function addSignature(signature) {
    try {
      const newSignature = {
        id: Date.now().toString(),
        name: signature.name,
        content: signature.content || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      signatures.value.push(newSignature)
      
      // 如果是第一个签名，设为默认
      if (signatures.value.length === 1) {
        defaultSignatureId.value = newSignature.id
      }
      
      await saveSignatures()
      
      return newSignature
    } catch (error) {
      console.error('Failed to add signature:', error)
      throw error
    }
  }
  
  /**
   * 更新签名
   */
  async function updateSignature(signatureId, updates) {
    try {
      const index = signatures.value.findIndex(s => s.id === signatureId)
      if (index !== -1) {
        signatures.value[index] = {
          ...signatures.value[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
        await saveSignatures()
      }
    } catch (error) {
      console.error('Failed to update signature:', error)
      throw error
    }
  }
  
  /**
   * 删除签名
   */
  async function deleteSignature(signatureId) {
    try {
      signatures.value = signatures.value.filter(s => s.id !== signatureId)
      
      // 如果删除的是默认签名，清空默认设置
      if (defaultSignatureId.value === signatureId) {
        defaultSignatureId.value = signatures.value.length > 0 
          ? signatures.value[0].id 
          : null
      }
      
      await saveSignatures()
    } catch (error) {
      console.error('Failed to delete signature:', error)
      throw error
    }
  }
  
  /**
   * 设置默认签名
   */
  async function setDefaultSignature(signatureId) {
    try {
      if (signatures.value.find(s => s.id === signatureId)) {
        defaultSignatureId.value = signatureId
        await saveSignatures()
      }
    } catch (error) {
      console.error('Failed to set default signature:', error)
      throw error
    }
  }
  
  /**
   * 获取单个签名
   */
  function getSignature(signatureId) {
    return signatures.value.find(s => s.id === signatureId)
  }
  
  /**
   * 获取默认签名
   */
  function getDefaultSignature() {
    return signatures.value.find(s => s.id === defaultSignatureId.value)
  }
  
  /**
   * 保存签名列表
   */
  async function saveSignatures() {
    try {
      await storageService.writeJSON('signatures.json', {
        signatures: signatures.value,
        defaultSignatureId: defaultSignatureId.value,
      })
    } catch (error) {
      console.error('Failed to save signatures:', error)
      throw error
    }
  }
  
  return {
    signatures,
    defaultSignatureId,
    loadSignatures,
    addSignature,
    updateSignature,
    deleteSignature,
    setDefaultSignature,
    getSignature,
    getDefaultSignature,
  }
})
