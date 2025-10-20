# Maillionaire

<div align="center">
  <img src="./design/ui-mockups/logo.png" alt="Maillionaire Logo" width="120" />
  <h1>Maillionaire</h1>
  <p>专业的跨平台邮件收发客户端</p>
  
  [![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/maillionaire/maillionaire)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-26.2.1-blue.svg)](https://www.electronjs.org/)
  [![Vue](https://img.shields.io/badge/Vue-3.3.4-brightgreen.svg)](https://vuejs.org/)
</div>

---

## ✨ 功能特性

### 📧 邮件收发
- ✅ 支持Gmail、QQ、163、126、Hotmail/Outlook等主流邮箱
- ✅ Gmail和Outlook采用OAuth2安全认证
- ✅ 按日期或数量筛选邮件
- ✅ 富文本编辑器撰写邮件
- ✅ 支持附件上传和下载
- ✅ 邮件详情弹窗查看

### 🗂️ 文件夹管理
- ✅ 收件箱、已发送、草稿箱、回收站等系统文件夹
- ✅ 自定义文件夹
- ✅ 文件夹同步服务器

### 📝 邮件模板与签名
- ✅ 创建和管理多个邮件模板
- ✅ 富文本签名编辑
- ✅ 设置默认签名
- ✅ 撰写邮件时快速应用模板和签名
- ✅ 模板包含主题和正文，提高编写效率

### 👥 通讯录
- ✅ 联系人管理（添加、编辑、删除）
- ✅ 分组管理
- ✅ 搜索联系人
- ✅ 导入/导出CSV格式

### 💾 本地存储
- ✅ 文件系统存储邮件数据
- ✅ 敏感信息加密
- ✅ 离线访问邮件

---

## 🚀 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 8.x 或 yarn >= 1.22.x

### 安装依赖

```bash
# 使用npm
npm install

# 或使用yarn
yarn install
```

### 开发模式

```bash
# 启动Web开发服务器
npm run dev

# 启动Electron开发模式
npm run electron:dev
```

访问 `http://localhost:5173` 查看应用

### 构建应用

```bash
# 构建Web版本
npm run build

# 构建Windows版本
npm run electron:build:win

# 构建macOS版本
npm run electron:build:mac

# 构建Linux版本
npm run electron:build:linux
```

构建产物位于 `dist-electron/` 目录

---

## 📁 项目结构

```
Maillionaire/
├── docs/                       # 文档目录
│   ├── PRD-产品需求文档.md
│   ├── UI交互时序图.md
│   ├── UI设计规范.md
│   ├── CHANGELOG.md
│   └── 二次开发文档.md
├── design/                     # 设计资源
│   └── ui-mockups/             # UI设计原型
│       ├── 01-login-page.html
│       ├── 02-main-interface.html
│       ├── 03-compose-mail.html
│       └── 04-contacts.html
├── electron/                   # Electron主进程
│   ├── main.js                 # 主进程入口
│   └── preload.js              # 预加载脚本
├── src/                        # 源代码目录
│   ├── assets/                 # 静态资源
│   ├── components/             # Vue组件
│   ├── views/                  # 页面视图
│   │   ├── Login.vue           # 登录页面
│   │   ├── Main.vue            # 主界面
│   │   ├── Contacts.vue        # 通讯录
│   │   ├── Settings.vue        # 设置
│   │   └── mail/               # 邮件相关页面
│   │       ├── Inbox.vue       # 收件箱
│   │       ├── Sent.vue        # 已发送
│   │       ├── Drafts.vue      # 草稿箱
│   │       └── Trash.vue       # 回收站
│   ├── stores/                 # Pinia状态管理
│   │   ├── app.js              # 应用状态
│   │   ├── account.js          # 账户管理
│   │   ├── mail.js             # 邮件管理
│   │   └── contact.js          # 通讯录管理
│   ├── services/               # 服务层
│   │   ├── storage.js          # 本地存储服务
│   │   ├── imap.js             # IMAP收件服务
│   │   ├── smtp.js             # SMTP发件服务
│   │   └── oauth.js            # OAuth2认证服务
│   ├── router/                 # 路由配置
│   │   └── index.js
│   ├── styles/                 # 样式文件
│   │   └── index.scss
│   ├── utils/                  # 工具函数
│   ├── App.vue                 # 根组件
│   └── main.js                 # 应用入口
├── build/                      # 构建资源
│   ├── icon.ico                # Windows图标
│   ├── icon.icns               # macOS图标
│   └── icon.png                # Linux图标
├── package.json                # 项目配置
├── vite.config.js              # Vite配置
└── README.md                   # 项目说明
```

---

## 🎯 使用指南

### 1. 添加邮箱账户

#### Gmail账户（OAuth2）
1. 点击"添加邮箱账户"
2. 选择"Gmail"
3. 点击"使用Google登录"
4. 完成OAuth2授权流程

#### QQ/163/126邮箱（IMAP）
1. 在邮箱设置中开启IMAP/SMTP服务
2. 生成授权码（非登录密码）
3. 在应用中添加账户时输入邮箱和授权码

### 2. 收取邮件

- 选择文件夹（收件箱、已发送等）
- 使用筛选条件：
  - 按日期：今天、最近7天、最近30天
  - 按数量：最新50封、100封
  - 按状态：未读、已读、有附件

### 3. 发送邮件

1. 点击"写邮件"按钮
2. 填写收件人、主题、正文
3. 使用富文本编辑器格式化内容
4. 添加附件（可选）
5. 应用模板或签名（可选）
6. 点击"发送"

### 4. 管理通讯录

- 添加联系人：填写姓名、邮箱、电话等信息
- 分组管理：同事、客户、朋友等
- 快速发邮件：点击联系人卡片上的邮件图标
- 导入/导出：支持CSV格式

### 5. 使用模板和签名

#### 邮件模板
1. 进入“设置” → “邮件模板”
2. 点击“新建模板”
3. 填写模板名称、主题和正文
4. 使用富文本编辑器格式化内容
5. 保存模板

**使用模板：**
- 撰写邮件时点击“使用模板”按钮
- 选择需要的模板
- 模板的主题和内容会自动填充
- 根据实际情况修改后发送

#### 个性化签名
1. 进入“设置” → “签名管理”
2. 点击“新建签名”
3. 编辑签名内容（支持富文本）
4. 设置默认签名
5. 保存签名

**使用签名：**
- 撰写邮件时点击“插入签名”按钮
- 选择想要使用的签名
- 签名会自动插入到邮件末尾
- 回复邮件时会自动插入默认签名

**更多详情，请查阅：**
- [邮件模板和签名使用指南](./docs/邮件模板和签名使用指南.md)
- [邮件模板和签名示例](./docs/邮件模板和签名示例.md)

---

## 🔧 配置说明

### 邮箱服务器配置

| 邮箱服务商 | IMAP服务器 | IMAP端口 | SMTP服务器 | SMTP端口 |
|-----------|-----------|---------|-----------|---------|
| Gmail | imap.gmail.com | 993 | smtp.gmail.com | 465 |
| QQ邮箱 | imap.qq.com | 993 | smtp.qq.com | 465 |
| 163邮箱 | imap.163.com | 993 | smtp.163.com | 465 |
| 126邮箱 | imap.126.com | 993 | smtp.126.com | 465 |
| Outlook | outlook.office365.com | 993 | smtp.office365.com | 587 |

### 本地数据存储路径

- **Windows**: `C:\Users\{用户名}\AppData\Roaming\Maillionaire\`
- **macOS**: `~/Library/Application Support/Maillionaire/`
- **Linux**: `~/.config/Maillionaire/`

---

## 🛠️ 技术栈

### 核心框架
- **Electron** - 跨平台桌面应用框架
- **Vue 3** - 渐进式JavaScript框架
- **Vite** - 下一代前端构建工具
- **Pinia** - Vue状态管理库

### UI组件
- **Ant Design Vue** - 企业级UI组件库
- **@vueup/vue-quill** - 富文本编辑器

### 邮件协议
- **imap** - IMAP协议库
- **nodemailer** - SMTP发送邮件
- **mailparser** - 邮件解析

### 工具库
- **dayjs** - 日期处理
- **crypto-js** - 加密库
- **axios** - HTTP客户端

---

## 📖 文档

- [产品需求文档（PRD）](./docs/PRD-产品需求文档.md)
- [UI交互时序图](./docs/UI交互时序图.md)
- [UI设计规范](./docs/UI设计规范.md)
- [二次开发文档](./docs/二次开发文档.md)
- [更新日志](./docs/CHANGELOG.md)
- [安装指南](./INSTALL.md)
- [快速入门](./QUICKSTART.md)
- [测试指南](./docs/测试指南.md)
- [邮件模板和签名使用指南](./docs/邮件模板和签名使用指南.md)
- [邮件模板和签名示例](./docs/邮件模板和签名示例.md)
- [文件夹同步功能指南](./docs/文件夹同步功能指南.md)
- [项目完成总结](./PROJECT_COMPLETION_SUMMARY.md)

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 📝 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](./LICENSE) 文件

---

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [Vue.js](https://vuejs.org/)
- [Ant Design Vue](https://antdv.com/)
- 所有开源贡献者

---

## 📧 联系我们

- 问题反馈：[GitHub Issues](https://github.com/maillionaire/maillionaire/issues)
- 邮箱：yi.cai1989@gmail.com

---

<div align="center">
  Made with ❤️ by Maillionaire Team
</div>
