# Maillionaire 项目文件结构

## 📂 完整目录树

```
Maillionaire/
│
├── 📄 README.md                      # 项目说明文档
├── 📄 QUICKSTART.md                  # 快速入门指南
├── 📄 DELIVERY.md                    # 项目交付清单
├── 📄 LICENSE                        # MIT开源许可证
├── 📄 .gitignore                     # Git忽略配置
├── 📄 package.json                   # NPM配置文件
├── 📄 vite.config.js                 # Vite构建配置
├── 📄 jsconfig.json                  # JavaScript配置
├── 📄 index.html                     # HTML入口文件
│
├── 📁 docs/                          # 文档目录
│   ├── 📄 PRD-产品需求文档.md        # 产品需求说明
│   ├── 📄 UI交互时序图.md            # 交互流程图（Mermaid）
│   ├── 📄 UI设计规范.md              # UI设计标准
│   ├── 📄 CHANGELOG.md               # 更新日志
│   ├── 📄 二次开发文档.md            # 开发者指南
│   └── 📄 项目总结.md                # 完成情况总结
│
├── 📁 design/                        # 设计资源
│   └── 📁 ui-mockups/                # UI设计原型
│       ├── 📄 01-login-page.html     # 登录页面设计
│       ├── 📄 02-main-interface.html # 主界面设计
│       ├── 📄 03-compose-mail.html   # 撰写邮件设计
│       ├── 📄 04-contacts.html       # 通讯录设计
│       └── 📄 README.md              # 设计图使用说明
│
├── 📁 electron/                      # Electron主进程
│   ├── 📄 main.js                    # 主进程入口
│   └── 📄 preload.js                 # 预加载脚本
│
└── 📁 src/                           # 源代码目录
    ├── 📄 main.js                    # Vue应用入口
    ├── 📄 App.vue                    # 根组件
    │
    ├── 📁 router/                    # 路由配置
    │   └── 📄 index.js               # 路由定义
    │
    ├── 📁 stores/                    # Pinia状态管理
    │   ├── 📄 app.js                 # 应用全局状态
    │   ├── 📄 account.js             # 账户管理
    │   ├── 📄 mail.js                # 邮件管理
    │   └── 📄 contact.js             # 通讯录管理
    │
    ├── 📁 services/                  # 业务逻辑服务
    │   ├── 📄 storage.js             # 本地存储服务
    │   ├── 📄 imap.js                # IMAP收件服务
    │   └── 📄 smtp.js                # SMTP发件服务
    │
    ├── 📁 views/                     # 页面视图
    │   ├── 📄 Login.vue              # ✅ 登录页面
    │   ├── 📄 Main.vue               # ❌ 主界面（待开发）
    │   ├── 📄 Contacts.vue           # ❌ 通讯录（待开发）
    │   ├── 📄 Settings.vue           # ❌ 设置（待开发）
    │   └── 📁 mail/                  # 邮件相关页面
    │       ├── 📄 Inbox.vue          # ❌ 收件箱（待开发）
    │       ├── 📄 Sent.vue           # ❌ 已发送（待开发）
    │       ├── 📄 Drafts.vue         # ❌ 草稿箱（待开发）
    │       └── 📄 Trash.vue          # ❌ 回收站（待开发）
    │
    ├── 📁 components/                # Vue组件（待创建）
    │   ├── 📁 common/                # 通用组件
    │   ├── 📁 mail/                  # 邮件组件
    │   └── 📁 editor/                # 编辑器组件
    │
    ├── 📁 styles/                    # 样式文件
    │   └── 📄 index.scss             # 全局样式
    │
    ├── 📁 utils/                     # 工具函数（待创建）
    │
    └── 📁 assets/                    # 静态资源（待添加）
        ├── 📁 images/
        ├── 📁 fonts/
        └── 📁 icons/
```

---

## 📊 文件统计

### 按类型统计

| 类型 | 数量 | 说明 |
|-----|------|------|
| 📄 文档文件 | 14 | Markdown格式 |
| 🎨 设计文件 | 4 | HTML原型 |
| ⚙️ 配置文件 | 5 | JSON/JS配置 |
| 🎯 Vue文件 | 2 | .vue组件 |
| 📦 Store文件 | 4 | Pinia stores |
| 🔧 Service文件 | 3 | 业务服务 |
| 🖥️ Electron文件 | 2 | 主进程代码 |
| **总计** | **34** | **已创建文件** |

### 按状态统计

| 状态 | 数量 | 百分比 |
|-----|------|--------|
| ✅ 已完成 | 27 | 79% |
| ⏳ 部分完成 | 1 | 3% |
| ❌ 待开发 | 6 | 18% |

---

## 📝 文件说明

### 根目录文件

| 文件 | 作用 | 重要性 |
|-----|------|--------|
| `README.md` | 项目说明、功能介绍、使用指南 | ⭐⭐⭐⭐⭐ |
| `QUICKSTART.md` | 5分钟快速开始指南 | ⭐⭐⭐⭐⭐ |
| `DELIVERY.md` | 项目交付清单和验收标准 | ⭐⭐⭐⭐ |
| `LICENSE` | MIT开源许可证 | ⭐⭐⭐ |
| `package.json` | NPM依赖和脚本配置 | ⭐⭐⭐⭐⭐ |
| `vite.config.js` | Vite构建配置 | ⭐⭐⭐⭐ |
| `jsconfig.json` | JavaScript/路径配置 | ⭐⭐⭐ |
| `.gitignore` | Git忽略规则 | ⭐⭐⭐ |

### 文档目录 (docs/)

| 文件 | 内容 | 字数 |
|-----|------|------|
| `PRD-产品需求文档.md` | 功能需求、技术栈、里程碑 | ~3500 |
| `UI交互时序图.md` | 10个交互流程Mermaid图 | ~5000 |
| `UI设计规范.md` | 色彩、字体、组件规范 | ~4000 |
| `二次开发文档.md` | 架构、模块、开发指南 | ~6500 |
| `CHANGELOG.md` | 版本记录、功能清单 | ~2000 |
| `项目总结.md` | 完成情况、待办、计划 | ~4000 |

### 设计目录 (design/ui-mockups/)

| 文件 | 页面 | 尺寸建议 |
|-----|------|---------|
| `01-login-page.html` | 登录页面 | 1920×1080 |
| `02-main-interface.html` | 主界面 | 1920×1080 |
| `03-compose-mail.html` | 撰写邮件 | 1600×900 |
| `04-contacts.html` | 通讯录 | 1920×1080 |

### 源代码目录 (src/)

#### Stores (状态管理)
| 文件 | 职责 | 完成度 |
|-----|------|--------|
| `app.js` | 全局状态、主题、侧边栏 | 100% |
| `account.js` | 账户CRUD、切换 | 100% |
| `mail.js` | 邮件列表、文件夹、筛选 | 100% |
| `contact.js` | 通讯录、分组、搜索 | 100% |

#### Services (服务层)
| 文件 | 功能 | 完成度 |
|-----|------|--------|
| `storage.js` | 本地JSON文件存储 | 100% |
| `imap.js` | IMAP协议收取邮件 | 100% |
| `smtp.js` | SMTP协议发送邮件 | 100% |

#### Views (页面视图)
| 文件 | 页面 | 完成度 |
|-----|------|--------|
| `Login.vue` | 登录/账户选择 | 80% |
| `Main.vue` | 主界面布局 | 0% ❌ |
| `Contacts.vue` | 通讯录管理 | 0% ❌ |
| `Settings.vue` | 应用设置 | 0% ❌ |
| `mail/Inbox.vue` | 收件箱 | 0% ❌ |
| `mail/Sent.vue` | 已发送 | 0% ❌ |
| `mail/Drafts.vue` | 草稿箱 | 0% ❌ |
| `mail/Trash.vue` | 回收站 | 0% ❌ |

---

## 🎯 待创建文件

### 组件层 (components/)

```
components/
├── common/                   # 通用组件
│   ├── Button.vue            # 自定义按钮
│   ├── Modal.vue             # 弹窗组件
│   ├── Loading.vue           # 加载动画
│   └── Empty.vue             # 空状态
│
├── mail/                     # 邮件组件
│   ├── MailList.vue          # 邮件列表
│   ├── MailItem.vue          # 邮件项
│   ├── MailDetail.vue        # 邮件详情弹窗
│   ├── ComposeModal.vue      # 撰写邮件弹窗
│   └── AttachmentList.vue    # 附件列表
│
└── editor/                   # 编辑器组件
    └── RichEditor.vue        # 富文本编辑器封装
```

### 工具函数 (utils/)

```
utils/
├── date.js                   # 日期格式化
├── validation.js             # 表单验证
├── crypto.js                 # 加密解密
├── formatter.js              # 数据格式化
└── constants.js              # 常量定义
```

### 静态资源 (assets/)

```
assets/
├── images/
│   ├── logo.png
│   └── placeholder.png
│
├── icons/
│   └── (SVG图标)
│
└── fonts/
    └── (字体文件)
```

---

## 📏 代码量统计

### 已实现代码
- **JavaScript/Vue**: ~2,500行
- **SCSS**: ~150行
- **HTML**: ~2,000行（设计原型）
- **Markdown**: ~10,000行（文档）

### 预估待开发代码
- **Vue组件**: ~3,000行
- **工具函数**: ~500行
- **样式文件**: ~500行

**总计预估**: ~18,650行

---

## 🔄 文件依赖关系

### 核心依赖流

```
main.js (入口)
  ↓
App.vue (根组件)
  ↓
router/index.js (路由)
  ↓
views/* (页面)
  ↓
components/* (组件)
  ↓
stores/* (状态) ← → services/* (服务)
  ↓
utils/* (工具)
```

### 状态管理流

```
Views
  ↓ dispatch action
Stores (Pinia)
  ↓ call service
Services
  ↓ access data
Storage / IMAP / SMTP
  ↓ return data
Stores
  ↓ update state
Views (reactive update)
```

---

## 📦 构建输出

### 开发环境
```
http://localhost:5173/
  ↓
Vite Dev Server
  ↓
Hot Module Reload
```

### 生产环境
```
npm run build
  ↓
dist/                      # Web构建输出
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
└── ...

npm run electron:build
  ↓
dist-electron/             # Electron应用
├── win-unpacked/          # Windows
├── mac/                   # macOS
└── linux-unpacked/        # Linux
```

---

## 🔍 快速查找

### 想要查看产品需求？
→ `docs/PRD-产品需求文档.md`

### 想要了解UI设计？
→ `design/ui-mockups/*.html`
→ `docs/UI设计规范.md`

### 想要开始开发？
→ `QUICKSTART.md`
→ `docs/二次开发文档.md`

### 想要了解进度？
→ `docs/项目总结.md`
→ `DELIVERY.md`

### 想要修改代码？
→ `src/` 目录下的源文件

---

**文档版本**: v1.0  
**最后更新**: 2025-10-19
