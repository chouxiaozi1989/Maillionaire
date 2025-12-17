# 🚀 安装和运行指南

## 📋 前置条件

请确保已安装以下软件：
- **Node.js**: v16.x 或更高版本
- **npm**: v8.x 或更高版本（或 yarn v1.22.x+）

## 📦 安装步骤

### 1. 进入项目目录

```bash
cd c:\Users\Administrator\Documents\Maillionaire
```

### 2. 安装依赖

```bash
npm install
```

> ⏳ **注意**: 首次安装可能需要 5-10 分钟，请耐心等待。

如果安装失败，可以尝试使用淘宝镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

### 3. 安装额外的依赖（DOMPurify用于HTML清理）

```bash
npm install dompurify
```

## 🎯 启动项目

### 开发模式

**方式1: Web开发模式**（推荐用于前端开发）

```bash
npm run dev
```

浏览器会自动打开 `http://localhost:5173`

**方式2: Electron开发模式**（完整桌面应用）

```bash
npm run electron:dev
```

会同时启动Vite开发服务器和Electron窗口

## 🔧 可能遇到的问题

### 问题1: npm install 失败

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules
rmdir /s /q node_modules

# 重新安装
npm install
```

### 问题2: Electron无法启动

**解决方案**:
```bash
# 单独安装electron
npm install electron --save-dev
```

### 问题3: 端口5173被占用

**解决方案**:
修改 `vite.config.js` 中的端口号：
```javascript
server: {
  port: 5174, // 改为其他端口
}
```

## ✅ 验证安装

安装成功后，你应该能看到：

1. **Web模式**: 浏览器显示登录页面
2. **Electron模式**: 桌面窗口打开并显示登录页面

## 📚 下一步

安装成功后，请查看：

1. **QUICKSTART.md** - 快速入门指南
2. **README.md** - 项目说明
3. **docs/二次开发文档.md** - 开发指南

## 🎨 查看UI设计

在浏览器中打开以下文件查看UI设计原型：

```
design/ui-mockups/01-login-page.html
design/ui-mockups/02-main-interface.html
design/ui-mockups/03-compose-mail.html
design/ui-mockups/04-contacts.html
```

## 💡 提示

- **首次启动**可能需要等待依赖下载和编译
- **热更新**已启用，修改代码后会自动刷新
- **开发工具**可以按F12打开（Electron模式）

---

**如有问题，请查看 `docs/` 目录下的详细文档**
