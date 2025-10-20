# OAuth2 配置指南

## 概述

Maillionaire 支持通过 OAuth2 协议安全地连接到 Gmail 和 Outlook 邮箱，无需直接使用密码。

---

## 测试模式

### 当前状态

如果未配置真实的 OAuth2 客户端 ID 和密钥，系统会自动启用**测试模式**：

- ✅ 可以添加 Gmail/Outlook 账户
- ✅ 使用模拟令牌进行认证
- ⚠️ 无法实际收发邮件
- 💡 适合开发和界面测试

### 测试模式特点

```javascript
// 测试模式会生成模拟令牌
{
  success: true,
  email: "test@gmail.com",
  provider: "gmail",
  accessToken: "test_access_token_1234567890",
  refreshToken: "test_refresh_token_1234567890",
  expiresAt: 1234567890000,
  testMode: true
}
```

---

## 配置 Gmail OAuth2

### 步骤 1: 创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 项目名称：`Maillionaire` 或自定义

### 步骤 2: 启用 Gmail API

1. 在左侧菜单中，选择 **API 和服务** → **库**
2. 搜索 `Gmail API`
3. 点击 **启用**

### 步骤 3: 创建 OAuth2 凭据

1. 选择 **API 和服务** → **凭据**
2. 点击 **创建凭据** → **OAuth 客户端 ID**
3. 应用类型：选择 **桌面应用**
4. 名称：`Maillionaire Desktop Client`
5. 点击 **创建**

### 步骤 4: 获取客户端 ID 和密钥

创建成功后，会显示：
- **客户端 ID**：类似 `123456789-abcdefg.apps.googleusercontent.com`
- **客户端密钥**：类似 `GOCSPX-abcdefghijklmnop`

### 步骤 5: 配置重定向 URI

1. 编辑刚创建的 OAuth 客户端
2. 在 **已授权的重定向 URI** 中添加：
   ```
   http://localhost:3000/oauth/callback
   ```
3. 保存更改

### 步骤 6: 配置环境变量

为了安全地存储 OAuth2 凭据，请使用环境变量文件：

1. **复制示例文件**：
   ```bash
   cp .env.example .env
   ```

2. **编辑 `.env` 文件**：
   ```env
   # Gmail OAuth2 配置
   VITE_GMAIL_CLIENT_ID=你的客户端ID
   VITE_GMAIL_CLIENT_SECRET=你的客户端密钥
   
   # OAuth2 回调地址
   VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
   ```

3. **重启应用**：
   ```bash
   npm run electron:dev
   ```

⚠️ **重要提示**：
- `.env` 文件已在 `.gitignore` 中，不会被提交到 Git
- `.env.example` 是配置示例，可以提交到仓库
- 如果未配置环境变量，系统会自动启用测试模式

---

## 配置 Outlook OAuth2

### 步骤 1: 注册应用

1. 访问 [Azure Portal](https://portal.azure.com/)
2. 选择 **Azure Active Directory** → **应用注册**
3. 点击 **新注册**

### 步骤 2: 配置应用

- **名称**：`Maillionaire`
- **受支持的账户类型**：选择"任何组织目录中的帐户和个人 Microsoft 帐户"
- **重定向 URI**：
  - 类型：**Web**
  - URI：`http://localhost:3000/oauth/callback`

### 步骤 3: 获取应用 ID

注册成功后，记录：
- **应用程序(客户端) ID**：类似 `12345678-1234-1234-1234-123456789012`

### 步骤 4: 创建客户端密钥

1. 选择 **证书和密码**
2. 点击 **新客户端密码**
3. 描述：`Maillionaire Client Secret`
4. 过期时间：选择合适的期限
5. 点击 **添加**
6. **立即复制密钥值**（只显示一次）

### 步骤 5: 配置 API 权限

1. 选择 **API 权限**
2. 点击 **添加权限** → **Microsoft Graph**
3. 选择 **委托的权限**
4. 添加以下权限：
   - `IMAP.AccessAsUser.All`
   - `SMTP.Send`
   - `offline_access`
5. 点击 **添加权限**

### 步骤 6: 配置环境变量

为了安全地存储 OAuth2 凭据，请使用环境变量文件：

1. **复制示例文件**：
   ```bash
   cp .env.example .env
   ```

2. **编辑 `.env` 文件**：
   ```env
   # Outlook OAuth2 配置
   VITE_OUTLOOK_CLIENT_ID=你的应用ID
   VITE_OUTLOOK_CLIENT_SECRET=你的客户端密钥
   
   # OAuth2 回调地址
   VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
   ```

3. **重启应用**：
   ```bash
   npm run electron:dev
   ```

⚠️ **重要提示**：
- `.env` 文件已在 `.gitignore` 中，不会被提交到 Git
- `.env.example` 是配置示例，可以提交到仓库
- 如果未配置环境变量，系统会自动启用测试模式

---

## Electron 集成（开发中）

### 当前实现

目前的 OAuth2 实现使用浏览器弹窗，适用于：
- ✅ Web 开发环境测试
- ✅ 浏览器中运行的应用

### 未来计划

为 Electron 环境实现专用的 OAuth2 流程：

```javascript
// 使用 Electron BrowserWindow
async openAuthWindow(provider, email) {
  if (window.electron) {
    const { BrowserWindow } = require('electron')
    
    const authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
    
    authWindow.loadURL(authUrl)
    
    // 监听重定向
    authWindow.webContents.on('will-redirect', (event, url) => {
      // 处理回调
    })
  }
}
```

---

## 安全注意事项

### 1. 保护客户端密钥

❌ **不要**：
- 将客户端密钥提交到公开仓库
- 在前端代码中硬编码密钥

✅ **应该**：
- 使用环境变量存储密钥
- 在服务器端处理令牌交换

### 2. 使用环境变量

⚠️ **当前配置方式（已实现）**：

项目已经支持通过 `.env` 文件管理 OAuth2 配置：

```env
# .env 文件
# Gmail OAuth2 配置
VITE_GMAIL_CLIENT_ID=你的客户端ID
VITE_GMAIL_CLIENT_SECRET=你的客户端密钥

# Outlook OAuth2 配置
VITE_OUTLOOK_CLIENT_ID=你的应用ID
VITE_OUTLOOK_CLIENT_SECRET=你的客户端密钥

# OAuth2 回调地址
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
```

✅ **优点**：
- `.env` 文件已在 `.gitignore` 中，不会被提交
- `.env.example` 提供配置示例
- Vite 自动加载 `VITE_` 前缀的环境变量
- 代码中通过 `import.meta.env.VITE_XXX` 访问

✅ **安全特性**：
- 如果未配置环境变量，系统自动启用测试模式
- 不会导致应用崩溃，只是无法连接真实邮箱

---

### 3. 首次配置步骤

1. **复制示例文件**：
   ```bash
   cp .env.example .env
   ```

2. **编辑 `.env` 文件**，填入你的 OAuth2 配置

3. **重启应用**：
   ```bash
   npm run electron:dev
   ```

---

### 4. 环境变量说明

| 变量名 | 描述 | 示例 |
|---------|------|------|
| `VITE_GMAIL_CLIENT_ID` | Gmail 客户端 ID | `123456-abc.apps.googleusercontent.com` |
| `VITE_GMAIL_CLIENT_SECRET` | Gmail 客户端密钥 | `GOCSPX-abcdefghijklmnop` |
| `VITE_OUTLOOK_CLIENT_ID` | Outlook 应用 ID | `12345678-1234-1234-1234-123456789012` |
| `VITE_OUTLOOK_CLIENT_SECRET` | Outlook 客户端密钥 | `abc~123defGHI456` |
| `VITE_OAUTH_REDIRECT_URI` | OAuth2 回调地址 | `http://localhost:3000/oauth/callback` |

创建 `.env` 文件（不要提交到 Git）：

```env
VITE_GMAIL_CLIENT_ID=your_gmail_client_id
VITE_GMAIL_CLIENT_SECRET=your_gmail_client_secret
VITE_OUTLOOK_CLIENT_ID=your_outlook_client_id
VITE_OUTLOOK_CLIENT_SECRET=your_outlook_client_secret
```

更新 `oauth.js`：

```javascript
gmailConfig = {
  clientId: import.meta.env.VITE_GMAIL_CLIENT_ID,
  clientSecret: import.meta.env.VITE_GMAIL_CLIENT_SECRET,
  // ...
}
```

### 3. HTTPS 要求

生产环境中：
- ✅ 使用 HTTPS 重定向 URI
- ✅ 验证 state 参数防止 CSRF
- ✅ 实现令牌刷新机制

---

## 测试流程

### 1. 测试模式（无需配置）

```bash
# 启动应用
npm run electron:dev

# 操作步骤：
# 1. 点击"添加邮箱账户"
# 2. 选择 Gmail 或 Outlook
# 3. 输入邮箱地址
# 4. 点击确定
# ✓ 自动使用测试模式认证
```

### 2. 真实认证（需要配置）

```bash
# 1. 配置 OAuth2 客户端 ID 和密钥
# 2. 启动应用
npm run electron:dev

# 3. 添加账户
# 4. 系统会打开授权窗口
# 5. 登录并授权
# 6. 自动完成认证
```

---

## 常见问题

### Q1: 授权窗口被拦截

**原因**：浏览器阻止了弹窗

**解决**：
- 允许当前网站的弹窗
- 或使用 Electron 环境（不受限制）

### Q2: 重定向 URI 不匹配

**错误**：`redirect_uri_mismatch`

**解决**：
1. 检查代码中的 `redirectUri` 与云控制台配置是否完全一致
2. 确保包含协议（http/https）
3. 确保端口号正确

### Q3: 令牌过期

**解决**：
- 使用 `refreshToken` 获取新的访问令牌
- 实现自动刷新机制

```javascript
async refreshAccessToken(account) {
  if (account.oauth2 && account.refreshToken) {
    const result = await oauth2Service.refreshToken(
      account.type,
      account.refreshToken
    )
    
    // 更新账户令牌
    await accountStore.updateAccount(account.id, {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    })
  }
}
```

### Q4: 测试模式无法收发邮件

**说明**：
- 测试模式仅用于界面测试
- 需要配置真实的 OAuth2 才能收发邮件
- 参考本文档完成配置

---

## 开发路线图

### v1.0.x（当前）
- ✅ 测试模式支持
- ✅ 基础 OAuth2 框架
- ⏳ 浏览器环境授权

### v1.1.0
- [ ] Electron 专用授权流程
- [ ] 自动令牌刷新
- [ ] 令牌安全存储

### v1.2.0
- [ ] 多账户 OAuth2 管理
- [ ] 撤销授权功能
- [ ] OAuth2 状态监控

---

## 参考资料

- [Google OAuth2 文档](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft OAuth2 文档](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Gmail API](https://developers.google.com/gmail/api)
- [Microsoft Graph Mail API](https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview)

---

**更新日期**：2025-10-19  
**版本**：v1.0.0
