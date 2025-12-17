<template>
  <a-modal
    :open="visible"
    :title="isEdit ? '编辑模板' : '新建模板'"
    :width="800"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :label-col="{ span: 4 }"
      :wrapper-col="{ span: 20 }"
    >
      <a-form-item label="模板名称" name="name">
        <a-input
          v-model:value="formData.name"
          placeholder="请输入模板名称"
          :maxlength="50"
        />
      </a-form-item>

      <a-form-item label="邮件主题" name="subject">
        <a-input
          v-model:value="formData.subject"
          placeholder="请输入邮件主题（可选）"
          :maxlength="200"
        />
      </a-form-item>

      <a-form-item label="邮件内容" name="body">
        <QuillEditor
          v-model:content="formData.body"
          content-type="html"
          :toolbar="editorToolbar"
          style="height: 300px"
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
  template: {
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
  subject: '',
  body: '',
})

const rules = {
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { min: 1, max: 50, message: '模板名称长度在 1 到 50 个字符', trigger: 'blur' },
  ],
}

// 富文本编辑器工具栏配置
const editorToolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ 'header': 1 }, { 'header': 2 }],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
  [{ 'indent': '-1' }, { 'indent': '+1' }],
  [{ 'size': ['small', false, 'large', 'huge'] }],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'align': [] }],
  ['link', 'image'],
  ['clean'],
]

watch(() => props.visible, (val) => {
  if (val) {
    if (props.template) {
      isEdit.value = true
      formData.value = {
        name: props.template.name,
        subject: props.template.subject || '',
        body: props.template.body || '',
      }
    } else {
      isEdit.value = false
      formData.value = {
        name: '',
        subject: '',
        body: '',
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
      id: props.template?.id,
    })

    message.success(isEdit.value ? '模板已更新' : '模板已创建')
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
  height: 250px;
}
</style>
