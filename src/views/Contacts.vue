<template>
  <div class="contacts-page">
    <a-layout class="contacts-layout">
      <!-- 左侧分组列表 -->
      <a-layout-sider :width="240" class="contacts-sidebar" theme="light">
        <div class="sidebar-header">
          <h3 class="sidebar-title">通讯录</h3>
          <a-button type="primary" block @click="showAddModal = true">
            <template #icon>
              <PlusOutlined />
            </template>
            添加联系人
          </a-button>
        </div>

        <a-menu
          v-model:selectedKeys="selectedGroup"
          mode="inline"
          class="group-menu"
          @select="handleGroupSelect"
        >
          <a-menu-item
            v-for="group in groups"
            :key="group.id"
          >
            <template #icon>
              <component :is="group.icon" />
            </template>
            {{ group.name }}
            <span class="group-count">{{ group.count }}</span>
          </a-menu-item>
        </a-menu>
      </a-layout-sider>

      <!-- 中间联系人列表 -->
      <a-layout-content class="contacts-main">
        <div class="main-header">
          <a-input-search
            v-model:value="searchKeyword"
            placeholder="搜索联系人..."
            class="search-input"
            @search="handleSearch"
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input-search>

          <a-space>
            <a-button @click="handleImport">
              <template #icon>
                <ImportOutlined />
              </template>
              导入
            </a-button>
            <a-button @click="handleExport">
              <template #icon>
                <ExportOutlined />
              </template>
              导出
            </a-button>
          </a-space>
        </div>

        <a-spin :spinning="loading">
          <div class="contacts-list">
            <a-empty v-if="!loading && displayContacts.length === 0" description="暂无联系人" />
            
            <div
              v-for="contact in displayContacts"
              :key="contact.id"
              class="contact-card"
              :class="{ selected: selectedContact?.id === contact.id }"
              @click="handleSelectContact(contact)"
            >
              <a-avatar :size="56" :style="{ backgroundColor: getAvatarColor(contact.name) }">
                {{ getInitial(contact.name) }}
              </a-avatar>

              <div class="contact-info">
                <div class="contact-name">{{ contact.name }}</div>
                <div class="contact-email">{{ contact.email }}</div>
                <div class="contact-meta">
                  <span v-if="contact.company">{{ contact.company }}</span>
                  <span v-if="contact.position"> • {{ contact.position }}</span>
                </div>
              </div>

              <div class="contact-actions" @click.stop>
                <a-button type="text" size="small" @click="handleComposeMail(contact)">
                  <template #icon>
                    <MailOutlined />
                  </template>
                </a-button>
                <a-button type="text" size="small" @click="handleEditContact(contact)">
                  <template #icon>
                    <EditOutlined />
                  </template>
                </a-button>
                <a-popconfirm
                  title="确定要删除这个联系人吗？"
                  ok-text="确定"
                  cancel-text="取消"
                  @confirm="handleDeleteContact(contact)"
                >
                  <a-button type="text" size="small" danger>
                    <template #icon>
                      <DeleteOutlined />
                    </template>
                  </a-button>
                </a-popconfirm>
              </div>
            </div>
          </div>
        </a-spin>
      </a-layout-content>

      <!-- 右侧联系人详情 -->
      <a-layout-sider v-if="selectedContact" :width="380" class="contact-detail" theme="light">
        <div class="detail-header">
          <a-avatar :size="100" :style="{ backgroundColor: getAvatarColor(selectedContact.name) }">
            {{ getInitial(selectedContact.name) }}
          </a-avatar>
          <h3 class="detail-name">{{ selectedContact.name }}</h3>
          <a-tag v-if="selectedContact.group" color="blue">
            {{ getGroupName(selectedContact.group) }}
          </a-tag>

          <div class="detail-actions">
            <a-button type="primary" block @click="handleComposeMail(selectedContact)">
              <template #icon>
                <MailOutlined />
              </template>
              发邮件
            </a-button>
            <a-button block @click="handleEditContact(selectedContact)">
              <template #icon>
                <EditOutlined />
              </template>
              编辑
            </a-button>
          </div>
        </div>

        <div class="detail-body">
          <div class="detail-section">
            <h4 class="section-title">基本信息</h4>
            <div class="detail-field">
              <div class="field-label">邮箱地址</div>
              <div class="field-value link">{{ selectedContact.email }}</div>
            </div>
            <div v-if="selectedContact.phone" class="detail-field">
              <div class="field-label">电话号码</div>
              <div class="field-value">{{ selectedContact.phone }}</div>
            </div>
          </div>

          <div v-if="selectedContact.company || selectedContact.position" class="detail-section">
            <h4 class="section-title">工作信息</h4>
            <div v-if="selectedContact.company" class="detail-field">
              <div class="field-label">公司</div>
              <div class="field-value">{{ selectedContact.company }}</div>
            </div>
            <div v-if="selectedContact.position" class="detail-field">
              <div class="field-label">职位</div>
              <div class="field-value">{{ selectedContact.position }}</div>
            </div>
          </div>

          <div v-if="selectedContact.notes" class="detail-section">
            <h4 class="section-title">备注</h4>
            <div class="detail-field">
              <div class="field-value">{{ selectedContact.notes }}</div>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="section-title">添加时间</h4>
            <div class="detail-field">
              <div class="field-value">{{ formatDate(selectedContact.createdAt) }}</div>
            </div>
          </div>
        </div>
      </a-layout-sider>
    </a-layout>

    <!-- 添加/编辑联系人弹窗 -->
    <ContactFormModal
      v-model:visible="showFormModal"
      :contact="editingContact"
      @saved="handleContactSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  PlusOutlined,
  SearchOutlined,
  ImportOutlined,
  ExportOutlined,
  MailOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  TeamOutlined,
  StarOutlined,
} from '@ant-design/icons-vue'
import { useContactStore } from '@/stores/contact'
import ContactFormModal from '@/components/contact/ContactFormModal.vue'

const contactStore = useContactStore()

// 状态
const loading = ref(false)
const searchKeyword = ref('')
const selectedGroup = ref(['all'])
const selectedContact = ref(null)
const showAddModal = ref(false)
const showFormModal = ref(false)
const editingContact = ref(null)

// 分组配置
const groups = computed(() => contactStore.groups.map(g => ({
  ...g,
  icon: g.id === 'all' ? UserOutlined :
        g.id === 'favorites' ? StarOutlined : TeamOutlined,
})))

// 显示的联系人列表
const displayContacts = computed(() => {
  let contacts = contactStore.getContactsByGroup(selectedGroup.value[0])
  
  if (searchKeyword.value) {
    contacts = contactStore.searchContacts(searchKeyword.value)
  }
  
  return contacts
})

/**
 * 获取头像颜色
 */
function getAvatarColor(name) {
  const colors = ['#1890FF', '#FA8C16', '#52C41A', '#13C2C2', '#722ED1']
  const index = (name?.charCodeAt(0) || 0) % colors.length
  return colors[index]
}

/**
 * 获取首字母
 */
function getInitial(name) {
  return name?.charAt(0).toUpperCase() || '?'
}

/**
 * 获取分组名称
 */
function getGroupName(groupId) {
  const group = groups.value.find(g => g.id === groupId)
  return group?.name || groupId
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return ''
  return dayjs(date).format('YYYY年MM月DD日')
}

/**
 * 分组选择
 */
function handleGroupSelect({ key }) {
  selectedGroup.value = [key]
  selectedContact.value = null
}

/**
 * 搜索联系人
 */
function handleSearch() {
  // 搜索逻辑已在computed中处理
}

/**
 * 选择联系人
 */
function handleSelectContact(contact) {
  selectedContact.value = contact
}

/**
 * 发送邮件
 */
function handleComposeMail(contact) {
  // TODO: 打开撰写邮件弹窗并填充收件人
  message.info(`发送邮件给: ${contact.email}`)
}

/**
 * 编辑联系人
 */
function handleEditContact(contact) {
  editingContact.value = contact
  showFormModal.value = true
}

/**
 * 删除联系人
 */
async function handleDeleteContact(contact) {
  try {
    await contactStore.deleteContact(contact.id)
    if (selectedContact.value?.id === contact.id) {
      selectedContact.value = null
    }
    message.success('联系人已删除')
  } catch (error) {
    message.error('删除失败：' + error.message)
  }
}

/**
 * 联系人保存后
 */
function handleContactSaved() {
  showFormModal.value = false
  editingContact.value = null
  message.success('保存成功')
}

/**
 * 导入联系人
 */
function handleImport() {
  // TODO: 实现CSV导入
  message.info('导入功能开发中...')
}

/**
 * 导出联系人
 */
function handleExport() {
  // TODO: 实现CSV导出
  message.info('导出功能开发中...')
}

// 初始化
onMounted(async () => {
  loading.value = true
  try {
    await contactStore.loadContacts()
  } catch (error) {
    message.error('加载联系人失败：' + error.message)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.contacts-page {
  height: 100%;
  background: white;
}

.contacts-layout {
  height: 100%;
}

.contacts-sidebar {
  border-right: 1px solid #F0F0F0;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #F0F0F0;
}

.sidebar-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}

.group-menu {
  border-right: none;
  
  :deep(.ant-menu-item) {
    display: flex;
    align-items: center;
    margin: 4px 8px;
    border-radius: 6px;
    
    &.ant-menu-item-selected {
      background: #E6F7FF;
      color: #1890FF;
    }
  }
}

.group-count {
  margin-left: auto;
  padding: 2px 8px;
  background: #F5F5F5;
  border-radius: 10px;
  font-size: 12px;
}

.contacts-main {
  display: flex;
  flex-direction: column;
}

.main-header {
  padding: 20px;
  border-bottom: 1px solid #F0F0F0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-input {
  flex: 1;
  max-width: 400px;
}

.contacts-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.contact-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid #F0F0F0;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: #1890FF;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
    
    .contact-actions {
      opacity: 1;
    }
  }
  
  &.selected {
    border-color: #1890FF;
    background: #F0F7FF;
  }
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-name {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 6px;
}

.contact-email {
  font-size: 14px;
  color: #1890FF;
  margin-bottom: 4px;
}

.contact-meta {
  font-size: 13px;
  color: #8C8C8C;
}

.contact-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.contact-detail {
  border-left: 1px solid #F0F0F0;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 24px;
  border-bottom: 1px solid #F0F0F0;
  text-align: center;
}

.detail-name {
  font-size: 20px;
  font-weight: 600;
  margin: 16px 0 8px;
}

.detail-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.detail-section {
  margin-bottom: 24px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #595959;
  margin-bottom: 12px;
}

.detail-field {
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.field-label {
  font-size: 12px;
  color: #8C8C8C;
  margin-bottom: 6px;
}

.field-value {
  font-size: 14px;
  color: #262626;
  word-break: break-all;
  
  &.link {
    color: #1890FF;
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
