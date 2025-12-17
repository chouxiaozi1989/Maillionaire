<template>
  <a-modal
    v-model:open="visible"
    title="撰写邮件"
    :width="900"
    :footer="null"
    :destroy-on-close="true"
    @cancel="handleClose"
  >
    <a-form
      ref="formRef"
      :model="formData"
      layout="vertical"
      class="compose-form"
    >
      <!-- 收件人 -->
      <a-form-item label="收件人" name="to" :rules="[{ required: true, message: '请输入收件人' }]">
        <a-select
          v-model:value="formData.to"
          mode="tags"
          placeholder="输入邮箱地址"
          :token-separators="[',', ';', ' ']"
          @search="handleSearchContact"
        >
          <a-select-option
            v-for="contact in filteredContacts"
            :key="contact.email"
            :value="contact.email"
          >
            {{ contact.name }} &lt;{{ contact.email }}&gt;
          </a-select-option>
        </a-select>
      </a-form-item>

      <!-- 抄送和密送 -->
      <div v-if="showCcBcc" class="cc-bcc-fields">
        <a-form-item label="抄送 (CC)" name="cc">
          <a-select
            v-model:value="formData.cc"
            mode="tags"
            placeholder="输入邮箱地址"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>

        <a-form-item label="密送 (BCC)" name="bcc">
          <a-select
            v-model:value="formData.bcc"
            mode="tags"
            placeholder="输入邮箱地址"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>
      </div>
      <a-button v-else type="link" size="small" @click="showCcBcc = true">
        显示抄送/密送
      </a-button>

      <!-- 主题 -->
      <a-form-item label="主题" name="subject" :rules="[{ required: true, message: '请输入主题' }]">
        <a-input v-model:value="formData.subject" placeholder="邮件主题" />
      </a-form-item>

      <!-- 富文本编辑器 -->
      <a-form-item label="正文" name="body">
        <div class="editor-container">
          <QuillEditor
            v-model:content="formData.body"
            content-type="html"
            :toolbar="editorToolbar"
            placeholder="请输入邮件内容..."
            class="rich-editor"
          />
        </div>
      </a-form-item>

      <!-- 附件 -->
      <a-form-item label="附件">
        <a-upload
          v-model:file-list="fileList"
          :before-upload="beforeUpload"
          @remove="handleRemoveFile"
        >
          <a-button>
            <template #icon>
              <PaperClipOutlined />
            </template>
            添加附件
          </a-button>
        </a-upload>
      </a-form-item>

      <!-- 底部操作栏 -->
      <div class="compose-footer">
        <a-space>
          <a-button type="primary" size="large" :loading="sending" @click="handleSend">
            <template #icon>
              <SendOutlined />
            </template>
            发送
          </a-button>
          <a-button size="large" @click="handleSaveDraft">
            保存草稿
          </a-button>
          <a-button size="large" @click="handleClose">
            取消
          </a-button>
        </a-space>

        <a-space>
          <a-dropdown>
            <a-button>
              <template #icon>
                <FileTextOutlined />
              </template>
              使用模板
            </a-button>
            <template #overlay>
              <a-menu @click="handleSelectTemplate">
                <a-menu-item v-for="template in templates" :key="template.id">
                  {{ template.name }}
                </a-menu-item>
                <a-menu-divider v-if="templates.length > 0" />
                <a-menu-item key="no-template" disabled v-if="templates.length === 0">
                  <span style="color: #BFBFBF;">暂无模板</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <a-dropdown>
            <a-button>
              <template #icon>
                <EditOutlined />
              </template>
              插入签名
            </a-button>
            <template #overlay>
              <a-menu @click="handleInsertSignature">
                <a-menu-item v-for="signature in signatures" :key="signature.id">
                  {{ signature.name }}
                  <a-tag v-if="signature.id === defaultSignatureId" color="blue" size="small" style="margin-left: 8px;">
                    默认
                  </a-tag>
                </a-menu-item>
                <a-menu-divider v-if="signatures.length > 0" />
                <a-menu-item key="no-signature" disabled v-if="signatures.length === 0">
                  <span style="color: #BFBFBF;">暂无签名</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </div>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import {
  PaperClipOutlined,
  SendOutlined,
  FileTextOutlined,
  EditOutlined,
} from '@ant-design/icons-vue'
import { useAccountStore } from '@/stores/account'
import { useContactStore } from '@/stores/contact'
import { useTemplateStore } from '@/stores/template'
import { useSignatureStore } from '@/stores/signature'
import { smtpService } from '@/services/smtp'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  replyTo: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:visible', 'sent'])

const accountStore = useAccountStore()
const contactStore = useContactStore()
const templateStore = useTemplateStore()
const signatureStore = useSignatureStore()

// 状态
const formRef = ref(null)
const formData = ref({
  to: [],
  cc: [],
  bcc: [],
  subject: '',
  body: '',
})
const fileList = ref([])
const showCcBcc = ref(false)
const sending = ref(false)
const searchKeyword = ref('')

// 富文本编辑器配置
const editorToolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ header: 1 }, { header: 2 }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ['link', 'image'],
  ['clean'],
]

// 计算属性
const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const filteredContacts = computed(() => {
  if (!searchKeyword.value) {
    return contactStore.contacts.slice(0, 10)
  }
  return contactStore.searchContacts(searchKeyword.value).slice(0, 10)
})

const templates = computed(() => templateStore.templates)
const signatures = computed(() => signatureStore.signatures)
const defaultSignatureId = computed(() => signatureStore.defaultSignatureId)

// 初始化加载
onMounted(async () => {
  await Promise.all([
    contactStore.loadContacts(),
    templateStore.loadTemplates(),
    signatureStore.loadSignatures(),
  ])
})

/**
 * 搜索联系人
 */
function handleSearchContact(value) {
  searchKeyword.value = value
}

/**
 * 上传前检查
 */
function beforeUpload(file) {
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error('附件大小不能超过 10MB!')
    return false
  }
  return false // 阻止自动上传，由我们手动处理
}

/**
 * 移除附件
 */
function handleRemoveFile(file) {
  const index = fileList.value.indexOf(file)
  if (index > -1) {
    fileList.value.splice(index, 1)
  }
}

/**
 * 选择模板
 */
function handleSelectTemplate({ key }) {
  const template = templateStore.getTemplate(key)
  if (template) {
    formData.value.subject = template.subject || ''
    formData.value.body = template.body || ''
    message.success(`已应用模板：${template.name}`)
  }
}

/**
 * 插入签名
 */
function handleInsertSignature({ key }) {
  const signature = signatureStore.getSignature(key)
  if (signature) {
    // 在邮件内容末尾插入签名
    const currentBody = formData.value.body || ''
    formData.value.body = currentBody + '<p><br></p>' + signature.content
    message.success(`已插入签名：${signature.name}`)
  }
}

/**
 * 发送邮件
 */
async function handleSend() {
  try {
    await formRef.value.validate()
    
    sending.value = true
    
    const account = accountStore.currentAccount
    if (!account) {
      message.error('请先选择发件账户')
      return
    }

    // 准备邮件数据
    const mailData = {
      to: formData.value.to.join(','),
      cc: formData.value.cc.join(','),
      bcc: formData.value.bcc.join(','),
      subject: formData.value.subject,
      html: formData.value.body,
      attachments: fileList.value.map(file => ({
        filename: file.name,
        path: file.originFileObj,
      })),
    }

    // TODO: 实际发送邮件
    // await smtpService.sendHtmlMail(account, mailData)
    
    // 模拟发送
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    message.success('邮件发送成功')
    emit('sent')
    handleClose()
  } catch (error) {
    console.error('Send failed:', error)
    if (error.errorFields) {
      message.error('请填写完整信息')
    } else {
      message.error('发送失败：' + error.message)
    }
  } finally {
    sending.value = false
  }
}

/**
 * 保存草稿
 */
async function handleSaveDraft() {
  try {
    // TODO: 保存到草稿箱
    message.success('草稿已保存')
  } catch (error) {
    message.error('保存失败：' + error.message)
  }
}

/**
 * 关闭弹窗
 */
function handleClose() {
  formData.value = {
    to: [],
    cc: [],
    bcc: [],
    subject: '',
    body: '',
  }
  fileList.value = []
  showCcBcc.value = false
  visible.value = false
}

// 监听回复邮件
watch(() => props.replyTo, (mail) => {
  if (mail) {
    formData.value.to = [mail.from]
    formData.value.subject = mail.subject.startsWith('Re:') 
      ? mail.subject 
      : 'Re: ' + mail.subject
    formData.value.body = `<p><br></p><p>---</p><blockquote>${mail.body}</blockquote>`
    
    // 自动插入默认签名（如果有）
    const defaultSignature = signatureStore.getDefaultSignature()
    if (defaultSignature) {
      formData.value.body = `<p><br></p><p><br></p>${defaultSignature.content}` + formData.value.body
    }
  }
}, { immediate: true })
</script>

<style lang="scss" scoped>
.compose-form {
  :deep(.ant-form-item) {
    margin-bottom: 16px;
  }
}

.cc-bcc-fields {
  padding: 16px;
  background: #FAFAFA;
  border-radius: 8px;
  margin-bottom: 16px;
  
  :deep(.ant-form-item) {
    margin-bottom: 12px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.editor-container {
  border: 1px solid #D9D9D9;
  border-radius: 8px;
  overflow: hidden;
  
  &:focus-within {
    border-color: #1890FF;
  }
}

.rich-editor {
  :deep(.ql-container) {
    min-height: 300px;
    font-size: 14px;
  }
  
  :deep(.ql-editor) {
    min-height: 300px;
    
    &.ql-blank::before {
      color: #BFBFBF;
      font-style: normal;
    }
  }
}

.compose-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid #F0F0F0;
}
</style>
