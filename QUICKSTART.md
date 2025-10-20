# Maillionaire 快速入门指南

## 🚀 5分钟快速开始

### 步骤1: 安装Node.js

如果还没有安装Node.js，请访问 [https://nodejs.org/](https://nodejs.org/) 下载并安装LTS版本（推荐16.x或更高）。

验证安装：
```bash
node -v    # 应该显示 v16.x.x 或更高
npm -v     # 应该显示 8.x.x 或更高
```

### 步骤2: 安装项目依赖

打开命令行，进入项目目录：

```bash
cd Maillionaire
npm install
```

> ⏳ 首次安装可能需要5-10分钟，请耐心等待

### 步骤3: 启动开发服务器

```bash
# 方式1: Web开发模式（推荐用于前端开发）
npm run dev

# 方式2: Electron开发模式（完整应用）
npm run electron:dev
```

浏览器会自动打开 `http://localhost:5173`

### 步骤4: 查看UI设计原型

在浏览器中打开以下HTML文件查看设计原型：

1. `design/ui-mockups/01-login-page.html` - 登录页面
2. `design/ui-mockups/02-main-interface.html` - 主界面
3. `design/ui-mockups/03-compose-mail.html` - 撰写邮件
4. `design/ui-mockups/04-contacts.html` - 通讯录

> 💡 **提示**: 可以截图保存为PNG格式作为UI设计图

---

## 📁 重要文档位置

### 必读文档
1. **README.md** - 项目整体说明
2. **docs/项目总结.md** - 当前完成情况和下一步计划
3. **docs/二次开发文档.md** - 开发者指南

### 设计文档
1. **docs/PRD-产品需求文档.md** - 功能需求
2. **docs/UI交互时序图.md** - 交互流程
3. **docs/UI设计规范.md** - 设计标准
4. **design/ui-mockups/** - UI设计原型

### 开发文档
1. **docs/CHANGELOG.md** - 更新日志
2. **docs/二次开发文档.md** - 代码开发指南

---

## 🔑 准备测试邮箱账号

在开始开发邮件功能前，需要准备测试邮箱账号并获取授权码。

### QQ邮箱授权码获取

1. 登录 [QQ邮箱](https://mail.qq.com)
2. 进入 **设置** → **账户**
3. 找到 **POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务**
4. 开启 **IMAP/SMTP服务**
5. 生成 **授权码**（保存好，相当于密码）

### 163邮箱授权码获取

1. 登录 [163邮箱](https://mail.163.com)
2. 进入 **设置** → **POP3/SMTP/IMAP**
3. 开启 **IMAP/SMTP服务**
4. 设置 **客户端授权密码**

### 126邮箱授权码获取

1. 登录 [126邮箱](https://mail.126.com)
2. 进入 **设置** → **POP3/SMTP/IMAP**
3. 开启 **IMAP/SMTP服务**
4. 设置 **客户端授权密码**

---

## 💻 开始开发

### 当前状态

✅ **已完成**:
- 项目架构搭建
- 状态管理(Pinia)
- 服务层(Storage, IMAP, SMTP)
- 登录页面
- 完整文档

⏳ **待开发**:
- 主界面布局
- 邮件列表组件
- 邮件详情弹窗
- 邮件发送功能
- 通讯录页面

### 推荐开发顺序

#### 第1步: 创建主界面布局
```bash
创建文件: src/views/Main.vue
```
参考: `design/ui-mockups/02-main-interface.html`

#### 第2步: 创建邮件列表组件
```bash
创建文件: src/components/mail/MailList.vue
```

#### 第3步: 创建收件箱页面
```bash
创建文件: src/views/mail/Inbox.vue
```

#### 第4步: 测试IMAP连接
在 `Inbox.vue` 中测试连接和获取邮件

#### 第5步: 创建邮件详情弹窗
```bash
创建文件: src/components/mail/MailDetail.vue
```

### 开发提示

1. **使用Ant Design Vue组件**
   ```vue
   <a-button type="primary">按钮</a-button>
   <a-modal v-model:open="visible">弹窗</a-modal>
   ```

2. **使用Pinia状态管理**
   ```javascript
   import { useMailStore } from '@/stores/mail'
   const mailStore = useMailStore()
   mailStore.loadMails('inbox')
   ```

3. **调用服务层**
   ```javascript
   import { imapService } from '@/services/imap'
   await imapService.connect(config)
   ```

---

## 🐛 常见问题

### Q1: npm install 失败怎么办？

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除node_modules
rm -rf node_modules

# 重新安装
npm install
```

或者使用淘宝镜像：
```bash
npm install --registry=https://registry.npmmirror.com
```

### Q2: IMAP连接失败？

**检查清单**:
- ✅ 是否使用授权码（而非登录密码）？
- ✅ 邮箱是否开启了IMAP服务？
- ✅ 服务器地址和端口是否正确？
- ✅ 防火墙是否允许连接？

### Q3: Electron窗口白屏？

**解决方案**:
```javascript
// 确保Vite服务器已启动
// 检查 electron/main.js 中的URL是否正确
mainWindow.loadURL('http://localhost:5173')

// 开发环境下打开DevTools查看错误
mainWindow.webContents.openDevTools()
```

### Q4: 找不到模块 '@/*'？

**解决方案**:
检查 `vite.config.js` 中的别名配置：
```javascript
resolve: {
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
}
```

---

## 📚 学习资源

### Vue 3
- [Vue 3 官方文档](https://vuejs.org/)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)

### Ant Design Vue
- [官方文档](https://antdv.com/)
- [组件示例](https://antdv.com/components/overview)

### Electron
- [官方文档](https://www.electronjs.org/docs)
- [IPC通信](https://www.electronjs.org/docs/latest/tutorial/ipc)

### Pinia
- [官方文档](https://pinia.vuejs.org/)
- [快速开始](https://pinia.vuejs.org/getting-started.html)

---

## 🎯 下一步做什么？

### 对于产品经理/设计师
1. 查看UI设计原型 (`design/ui-mockups/`)
2. 阅读产品需求文档 (`docs/PRD-产品需求文档.md`)
3. 提供反馈和建议

### 对于前端开发者
1. 阅读二次开发文档 (`docs/二次开发文档.md`)
2. 查看项目总结了解当前进度 (`docs/项目总结.md`)
3. 开始开发主界面 (`src/views/Main.vue`)

### 对于后端开发者
1. 了解IMAP/SMTP服务实现 (`src/services/`)
2. 优化邮件协议处理逻辑
3. 实现OAuth2认证

### 对于测试人员
1. 准备测试邮箱账号
2. 阅读功能需求文档
3. 编写测试用例

---

## 📞 获取帮助

- **问题反馈**: [GitHub Issues](https://github.com/maillionaire/maillionaire/issues)
- **文档问题**: 查看 `docs/` 目录下的详细文档
- **代码问题**: 参考 `docs/二次开发文档.md`

---

## 🎉 开始你的开发之旅！

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 在浏览器中访问
# http://localhost:5173

# 4. 开始编码！
```

**Happy Coding! 🚀**

---

**文档版本**: v1.0  
**最后更新**: 2025-10-19
