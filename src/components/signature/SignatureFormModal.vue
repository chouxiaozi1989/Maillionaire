<template>
  <a-modal
    :open="visible"
    :title="isEdit ? '编辑签名' : '新建签名'"
    :width="700"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :label-col="{ span: 4 }"
      :wrapper-col="{ span: 20 }"
    >
      <a-form-item label="签名名称" name="name">
        <a-input
          v-model:value="formData.name"
          placeholder="请输入签名名称"
          :maxlength="50"
        />
      </a-form-item>

      <a-form-item label="签名内容" name="content">
        <QuillEditor
          v-model:content="formData.content"
          content-type="html"
          :toolbar="editorToolbar"
          style="height: 250px"
        />
      </a-form-item>
    </a-form>

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleSubmit" :loading="loading">
        {{ isEdit ? '保存' : '创建' }}
      </a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  signature: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible', 'submit'])

const formRef = ref()
const loading = ref(false)
const isEdit = ref(false)

const formData = ref({
  name: '',
  content: '',
})

const rules = {
  name: [
    { required: true, message: '请输入签名名称', trigger: 'blur' },
    { min: 1, max: 50, message: '签名名称长度在 1 到 50 个字符', trigger: 'blur' },
  ],
  content: [
    { required: true, message: '请输入签名内容', trigger: 'blur' },
  ],
}

// 富文本编辑器工具栏配置
const editorToolbar = [
  ['bold', 'italic', 'underline'],
  [{ 'size': ['small', false, 'large'] }],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'align': [] }],
  ['link', 'image'],
  ['clean'],
]

watch(() => props.visible, (val) => {
  if (val) {
    if (props.signature) {
      isEdit.value = true
      formData.value = {
        name: props.signature.name,
        content: props.signature.content || '',
      }
    } else {
      isEdit.value = false
      formData.value = {
        name: '',
        content: '',
      }
    }
  }
})

function handleCancel() {
  emit('update:visible', false)
}

async function handleSubmit() {
  try {
    await formRef.value.validate()
    loading.value = true

    emit('submit', {
      ...formData.value,
      id: props.signature?.id,
    })

    message.success(isEdit.value ? '签名已更新' : '签名已创建')
    emit('update:visible', false)
  } catch (error) {
    console.error('表单验证失败:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
:deep(.ql-container) {
  height: 200px;
}
</style>
