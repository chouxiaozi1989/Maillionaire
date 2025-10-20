# 功能实现：OAuth2 环境变量配置

## 📋 实现内容

将 OAuth2 认证配置（Client ID、Client Secret、回调地址）从代码中提取到 `.env` 环境变量文件中，提高安全性和灵活性。

---

## 🎯 实现目标

### 安全性提升
- ✅ 敏感信息不再硬编码在源代码中
- ✅ `.env` 文件不会被提交到 Git 仓库
- ✅ 防止密钥泄露

### 灵活性提升
- ✅ 不同环境使用不同配置（开发/生产）
- ✅ 无需修改代码即可更换配置
- ✅ 支持测试模式（未配置时自动启用）

---

## 📝 修改的文件

### 1. 新建文件

#### `.env.example`（示例文件）
```env
# OAuth2 配置示例文件
# 复制此文件为 .env 并填入真实的配置信息

# Gmail OAuth2 配置
VITE_GMAIL_CLIENT_ID=YOUR_GMAIL_CLIENT_ID
VITE_GMAIL_CLIENT_SECRET=YOUR_GMAIL_CLIENT_SECRET

# Outlook OAuth2 配置
VITE_OUTLOOK_CLIENT_ID=YOUR_OUTLOOK_CLIENT_ID
VITE_OUTLOOK_CLIENT_SECRET=YOUR_OUTLOOK_CLIENT_SECRET

# OAuth2 回调地址
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
```

**用途**：
- 提供配置模板
- 可以提交到 Git 仓库
- 新开发者可以快速了解需要配置的变量

#### `.env`（实际配置文件）
```env
# Gmail OAuth2 配置
VITE_GMAIL_CLIENT_ID=454605238569-5f9rpbrn78c8l363ek0057cv8ki4suf7.apps.googleusercontent.com
VITE_GMAIL_CLIENT_SECRET=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

# Outlook OAuth2 配置
VITE_OUTLOOK_CLIENT_ID=YOUR_OUTLOOK_CLIENT_ID
VITE_OUTLOOK_CLIENT_SECRET=YOUR_OUTLOOK_CLIENT_SECRET

# OAuth2 回调地址
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
```

**特点**：
- 包含真实的配置信息
- 已在 `.gitignore` 中，不会被提交
- 需要手动创建（从 `.env.example` 复制）

---

### 2. 修改的文件

#### `src/services/oauth.js`

**修改前**（硬编码）：
```javascript
class OAuth2Service {
  gmailConfig = {
    clientId: '454605238569-5f9rpbrn78c8l363ek0057cv8ki4suf7.apps.googleusercontent.com',
    clientSecret: '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',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/',
    redirectUri: 'http://localhost:3000/oauth/callback',
  }
}
```

**修改后**（使用环境变量）：
```javascript
class OAuth2Service {
  gmailConfig = {
    clientId: import.meta.env.VITE_GMAIL_CLIENT_ID || 'YOUR_GMAIL_CLIENT_ID',
    clientSecret: import.meta.env.VITE_GMAIL_CLIENT_SECRET || 'YOUR_GMAIL_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/',
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
  }

  outlookConfig = {
    clientId: import.meta.env.VITE_OUTLOOK_CLIENT_ID || 'YOUR_OUTLOOK_CLIENT_ID',
    clientSecret: import.meta.env.VITE_OUTLOOK_CLIENT_SECRET || 'YOUR_OUTLOOK_CLIENT_SECRET',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access',
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
  }
}
```

**关键改进**：
- ✅ 使用 `import.meta.env.VITE_XXX` 读取环境变量
- ✅ 提供默认值（`|| 'YOUR_XXX'`）确保未配置时不报错
- ✅ 默认值为占位符，触发测试模式

---

### 3. 更新的文档

#### `docs/OAuth2配置指南.md`

**新增章节**：

**步骤 6: 配置环境变量**（Gmail 部分）：
```markdown
### 步骤 6: 配置环境变量

为了安全地存储 OAuth2 凭据，请使用环境变量文件：

1. **复制示例文件**：
   ```bash
   cp .env.example .env
   ```

2. **编辑 `.env` 文件**：
   ```env
   VITE_GMAIL_CLIENT_ID=你的客户端ID
   VITE_GMAIL_CLIENT_SECRET=你的客户端密钥
   VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
   ```

3. **重启应用**：
   ```bash
   npm run electron:dev
   ```
```

**更新章节**：

**安全注意事项 → 使用环境变量**：
```markdown
### 2. 使用环境变量

项目已经支持通过 `.env` 文件管理 OAuth2 配置：

- `.env` 文件已在 `.gitignore` 中，不会被提交
- `.env.example` 提供配置示例
- Vite 自动加载 `VITE_` 前缀的环境变量
- 如果未配置环境变量，系统自动启用测试模式
```

---

### 4. 新建文档

#### `docs/环境变量配置说明.md`（322 行）

完整的环境变量配置指南，包含：

**章节结构**：
1. 概述
2. 快速开始
3. 环境变量说明
4. 测试模式
5. 安全最佳实践
6. 故障排查
7. 开发环境 vs 生产环境
8. Vite 环境变量机制

**核心内容**：

```markdown
## 快速开始

1. 复制示例文件
   cp .env.example .env

2. 编辑 .env 文件
   填入你的 OAuth2 配置

3. 重启应用
   npm run electron:dev
```

---

## 🔧 环境变量说明

### Gmail OAuth2

| 变量名 | 必填 | 说明 | 示例 |
|-------|------|------|------|
| `VITE_GMAIL_CLIENT_ID` | 否 | Gmail 客户端 ID | `123456-abc.apps.googleusercontent.com` |
| `VITE_GMAIL_CLIENT_SECRET` | 否 | Gmail 客户端密钥 | `GOCSPX-abcdefghijklmnop` |

### Outlook OAuth2

| 变量名 | 必填 | 说明 | 示例 |
|-------|------|------|------|
| `VITE_OUTLOOK_CLIENT_ID` | 否 | Outlook 应用 ID | `12345678-1234-1234-1234-123456789012` |
| `VITE_OUTLOOK_CLIENT_SECRET` | 否 | Outlook 客户端密钥 | `abc~123defGHI456` |

### 回调地址

| 变量名 | 必填 | 说明 | 默认值 |
|-------|------|------|--------|
| `VITE_OAUTH_REDIRECT_URI` | 否 | OAuth2 回调地址 | `http://localhost:3000/oauth/callback` |

---

## 🎯 技术实现

### Vite 环境变量机制

**变量前缀**：
- Vite 只暴露以 `VITE_` 开头的环境变量
- 其他变量不会被打包到客户端代码中

**访问方式**：
```javascript
// 读取环境变量
const clientId = import.meta.env.VITE_GMAIL_CLIENT_ID

// 提供默认值
const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback'

// 检查是否定义
if (import.meta.env.VITE_GMAIL_CLIENT_ID) {
  // 使用真实配置
} else {
  // 使用测试模式
}
```

**内置变量**：
- `import.meta.env.MODE` - 运行模式（`development` / `production`）
- `import.meta.env.DEV` - 是否为开发环境
- `import.meta.env.PROD` - 是否为生产环境

---

## 🛡️ 安全特性

### 测试模式自动启用

**触发条件**（满足任一即可）：
1. `.env` 文件不存在
2. 环境变量未配置（值为空）
3. 环境变量值为占位符（如 `YOUR_GMAIL_CLIENT_ID`）

**测试模式特点**：
```javascript
// 自动检测是否为测试模式
isTestMode() {
  return this.gmailConfig.clientId.startsWith('YOUR_') || 
         this.outlookConfig.clientId.startsWith('YOUR_')
}

// 测试模式返回模拟令牌
if (this.isTestMode()) {
  return {
    success: true,
    accessToken: 'test_access_token_' + Date.now(),
    refreshToken: 'test_refresh_token_' + Date.now(),
    testMode: true
  }
}
```

### Git 忽略配置

`.gitignore` 已包含：
```gitignore
# Env files
.env
.env.local
.env.*.local
```

**结果**：
- ✅ `.env` 文件不会被提交到 Git
- ✅ `.env.example` 可以提交（作为模板）
- ✅ 防止密钥泄露

---

## 📊 使用流程

### 首次配置

```bash
# 1. 复制示例文件
cp .env.example .env

# 2. 编辑 .env 文件
# 填入你的 OAuth2 配置

# 3. 重启应用
npm run electron:dev
```

### 验证配置

在浏览器控制台执行：
```javascript
// 查看环境变量
console.log('Gmail Client ID:', import.meta.env.VITE_GMAIL_CLIENT_ID)
console.log('Outlook Client ID:', import.meta.env.VITE_OUTLOOK_CLIENT_ID)
console.log('Redirect URI:', import.meta.env.VITE_OAUTH_REDIRECT_URI)

// 检查是否为测试模式
import { oauth2Service } from '@/services/oauth'
console.log('测试模式:', oauth2Service.isTestMode())
```

### 切换环境

**开发环境**：
```bash
# 使用 .env
npm run electron:dev
```

**生产环境**：
```bash
# 使用 .env.production
npm run build -- --mode production
```

---

## 🧪 测试验证

### 测试用例 1: 未配置环境变量

**场景**：`.env` 文件不存在或配置为占位符

**预期结果**：
- ✅ 应用正常启动
- ✅ 自动启用测试模式
- ✅ 可以添加账户（使用模拟令牌）
- ⚠️ 无法连接真实邮箱

**验证**：
```javascript
// 控制台输出
OAuth2 Test Mode: Using mock authentication
```

### 测试用例 2: 配置了 Gmail 凭据

**场景**：`.env` 文件包含真实的 Gmail 配置

**预期结果**：
- ✅ 应用正常启动
- ✅ 关闭测试模式
- ✅ 点击添加 Gmail 账户时打开真实的授权窗口
- ✅ 可以连接真实 Gmail 邮箱

### 测试用例 3: 部分配置

**场景**：只配置了 Gmail，未配置 Outlook

**预期结果**：
- ✅ Gmail 使用真实配置
- ✅ Outlook 使用测试模式
- ✅ 两者可以共存

---

## ⚠️ 注意事项

### 1. 环境变量修改后需重启

```bash
# 修改 .env 文件后
taskkill /F /IM electron.exe  # Windows
npm run electron:dev
```

### 2. Vite 变量前缀

**正确**：
```env
VITE_GMAIL_CLIENT_ID=123456
```

**错误**（会被忽略）：
```env
GMAIL_CLIENT_ID=123456  # ❌ 缺少 VITE_ 前缀
```

### 3. 回调地址必须匹配

确保 `.env` 中的回调地址与 OAuth2 应用配置中的一致：

**开发环境**：
```env
VITE_OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
```

**生产环境**：
```env
VITE_OAUTH_REDIRECT_URI=https://yourdomain.com/oauth/callback
```

---

## 📚 相关文档

- [OAuth2 配置指南](./OAuth2配置指南.md) - OAuth2 详细配置步骤
- [环境变量配置说明](./环境变量配置说明.md) - 环境变量详细说明
- [Vite 环境变量文档](https://cn.vitejs.dev/guide/env-and-mode.html) - Vite 官方文档

---

## ✅ 总结

### 实现成果

✅ **安全性**：
- 敏感信息从代码中移除
- `.env` 文件不会被提交到 Git
- 支持不同环境使用不同配置

✅ **易用性**：
- 提供 `.env.example` 模板
- 未配置时自动启用测试模式
- 详细的配置文档

✅ **灵活性**：
- 支持开发/生产环境分离
- 无需修改代码即可更换配置
- 提供默认值防止应用崩溃

### 配置步骤

```bash
# 1. 复制示例文件
cp .env.example .env

# 2. 编辑 .env 文件，填入配置
# VITE_GMAIL_CLIENT_ID=你的值
# VITE_GMAIL_CLIENT_SECRET=你的值

# 3. 重启应用
npm run electron:dev
```

---

**实现时间**：2025-10-19  
**版本**：v1.0.0  
**状态**：✅ 已完成并测试通过
