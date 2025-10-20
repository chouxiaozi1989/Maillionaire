<template>
  <a-modal
    v-model:open="visible"
    :title="isEdit ? '编辑联系人' : '添加联系人'"
    :width="600"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      layout="vertical"
    >
      <a-form-item label="姓名" name="name">
        <a-input v-model:value="formData.name" placeholder="请输入姓名" />
      </a-form-item>

      <a-form-item label="邮箱地址" name="email">
        <a-input v-model:value="formData.email" placeholder="example@email.com" />
      </a-form-item>

      <a-form-item label="电话号码" name="phone">
        <a-input v-model:value="formData.phone" placeholder="请输入电话号码" />
      </a-form-item>

      <a-form-item label="公司" name="company">
        <a-input v-model:value="formData.company" placeholder="请输入公司名称" />
      </a-form-item>

      <a-form-item label="职位" name="position">
        <a-input v-model:value="formData.position" placeholder="请输入职位" />
      </a-form-item>

      <a-form-item label="分组" name="group">
        <a-select v-model:value="formData.group" placeholder="请选择分组">
          <a-select-option value="colleagues">同事</a-select-option>
          <a-select-option value="clients">客户</a-select-option>
          <a-select-option value="friends">朋友</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="备注" name="notes">
        <a-textarea v-model:value="formData.notes" :rows="3" placeholder="备注信息" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useContactStore } from '@/stores/contact'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  contact: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible', 'saved'])

const contactStore = useContactStore()
const formRef = ref(null)
const formData = ref({
  name: '',
  email: '',
  phone: '',
  company: '',
  position: '',
  group: '',
  notes: '',
})

const rules = {
  name: [{ required: true, message: '请输入姓名' }],
  email: [
    { required: true, message: '请输入邮箱地址' },
    { type: 'email', message: '请输入有效的邮箱地址' },
  ],
}

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const isEdit = computed(() => !!props.contact)

watch(() => props.contact, (contact) => {
  if (contact) {
    formData.value = { ...contact }
  } else {
    formData.value = {
      name: '',
      email: '',
      phone: '',
      company: '',
      position: '',
      group: '',
      notes: '',
    }
  }
}, { immediate: true })

async function handleSubmit() {
  try {
    await formRef.value.validate()
    
    if (isEdit.value) {
      await contactStore.updateContact(props.contact.id, formData.value)
    } else {
      await contactStore.addContact(formData.value)
    }
    
    emit('saved')
  } catch (error) {
    console.error('Save contact failed:', error)
  }
}

function handleCancel() {
  formRef.value.resetFields()
  visible.value = false
}
</script>
