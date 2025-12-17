# QQ邮箱添加问题排查与修复

## 问题描述

用户反馈无法添加QQ邮箱账户，需要排查并修复该问题。

## 可能的原因分析

### 1. 用户操作问题

#### 1.1 未启用IMAP/SMTP服务
**问题**：QQ邮箱默认不开启IMAP/SMTP服务，需要手动开启。

**解决方法**：
1. 登录 QQ 邮箱网页版
2. 进入「设置」→「账户」
3. 在「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务」中：
   - 开启「IMAP/SMTP服务」
   - 生成授权码并保存

#### 1.2 使用登录密码而非授权码
**问题**：QQ邮箱不接受登录密码，必须使用授权码。

**当前提示**：
```vue
<a-alert
  v-if="formData.type === 'qq'"
  message="请使用授权码而非登录密码"
  description="授权码可在邮箱设置中生成，用于第三方客户端登录"
  type="info"
  show-icon
/>
```

**改进建议**：提示可以更明确，包含具体操作步骤。

### 2. 配置问题

#### 2.1 QQ邮箱服务器配置
当前配置（`Login.vue` 第145-151行）：
```javascript
qq: {
  imapHost: 'imap.qq.com',
  imapPort: 993,
  smtpHost: 'smtp.qq.com',
  smtpPort: 465,
}
```

✅ **配置正确**
- IMAP: `imap.qq.com:993` (SSL/TLS)
- SMTP: `smtp.qq.com:465` (SSL/TLS)

#### 2.2 TLS配置
当前 IMAP 配置（`electron/services/imap-main.js` 第164-169行）：
```javascript
const imapConfig = {
  user: config.email,
  password: config.password || config.accessToken,
  host: config.imapHost,
  port: config.imapPort || 993,
  tls: config.tls !== false,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 30000,
  authTimeout: 30000,
};
```

✅ **配置正确**
- `tls: true` - 启用 TLS/SSL
- `tlsOptions: { rejectUnauthorized: false }` - 禁用证书验证（避免自签名证书问题）
- 超时设置合理

### 3. 验证逻辑问题

#### 3.1 验证流程分析

**当前流程**：
```javascript
// Login.vue - handleAddAccount()
const loadingMsg = message.loading('正在验证账户连接...', 0)
const newAccount = await accountStore.addAccountWithVerify(account, skipVerify)
```

**`addAccountWithVerify` 方法**（`account.js` 第109-134行）：
```javascript
async function addAccountWithVerify(account, skipVerify = false) {
  try {
    const newAccount = {
      id: Date.now().toString(),
      ...account,
      connected: false,
      createdAt: new Date().toISOString(),
    }
    
    // 如果不跳过验证，尝试连接
    if (!skipVerify) {
      const verifyResult = await verifyAccount(newAccount)
      newAccount.connected = verifyResult.imap && verifyResult.smtp
      newAccount.verifyResult = verifyResult
      newAccount.lastVerifiedAt = new Date().toISOString()
    }
    
    accounts.value.push(newAccount)
    await saveAccounts()
    
    return newAccount
  } catch (error) {
    console.error('Failed to add account:', error)
    throw error
  }
}
```

**`verifyAccount` 方法**（`account.js` 第44-106行）：
```javascript
async function verifyAccount(account) {
  try {
    const results = {
      imap: false,
      smtp: false,
      errors: [],
    }
    
    // 如果是 OAuth2 账户，跳过验证
    if (account.oauth2) {
      console.log('[Account] OAuth2 account - skipping IMAP/SMTP verification')
      return {
        imap: true,
        smtp: true,
        oauth2: true,
        message: 'OAuth2 认证已验证账户有效性',
      }
    }
    
    // 验证 IMAP 连接
    try {
      await imapService.connect({
        email: account.email,
        password: account.password,
        imapHost: account.imapHost,
        imapPort: account.imapPort,
      })
      results.imap = true
      console.log('[Account] IMAP connection verified')
      
      // 连接成功后断开
      await imapService.disconnect()
    } catch (error) {
      console.error('[Account] IMAP verification failed:', error)
      results.errors.push(`IMAP: ${error.message}`)
    }
    
    // 验证 SMTP 连接
    try {
      await smtpService.verify({
        email: account.email,
        password: account.password,
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
      })
      results.smtp = true
      console.log('[Account] SMTP connection verified')
    } catch (error) {
      console.error('[Account] SMTP verification failed:', error)
      results.errors.push(`SMTP: ${error.message}`)
    }
    
    return results
  } catch (error) {
    console.error('[Account] Verification failed:', error)
    throw error
  }
}
```

#### 3.2 问题点

1. **IMAP 验证失败不会抛出错误**
   - 即使 IMAP 连接失败，`verifyAccount` 也会返回结果
   - 但账户会被标记为 `connected: false`

2. **错误信息不够明确**
   - 只显示 `results.errors` 的内容
   - 用户可能不知道具体是什么问题

3. **浏览器模式跳过验证**
   ```javascript
   // imap.js
   async connect(config) {
     if (this.isElectron) {
       return await window.electronAPI.connectImap(config)
     } else {
       console.warn('[IMAP] Browser mode: connection skipped')
       return true  // ❌ 浏览器模式总是返回成功
     }
   }
   ```

### 4. 错误处理问题

#### 4.1 Login.vue 的错误处理

当前实现（`Login.vue` 第353-374行）：
```javascript
try {
  const newAccount = await accountStore.addAccountWithVerify(account, skipVerify)
  loadingMsg()
  
  // 检查验证结果
  if (!skipVerify && newAccount.verifyResult) {
    const { imap, smtp, errors } = newAccount.verifyResult
    
    if (imap && smtp) {
      message.success('账户添加成功，连接验证通过')
    } else {
      const errorMsg = errors.join('; ')
      message.warning(`账户已添加，但连接验证失败: ${errorMsg}`)
    }
  } else {
    message.success('账户添加成功')
  }
  
  // 自动登录新添加的账户
  await handleLogin(newAccount)
} catch (error) {
  loadingMsg()
  throw error
}
```

**问题**：
1. ✅ 验证失败会显示 warning，但不会阻止账户添加
2. ✅ 验证失败后仍然会自动登录
3. ❌ 错误信息可能不够明确

## 修复方案

### 方案1：增强错误提示（推荐）

**目标**：让用户更清楚地知道问题所在

**修改 Login.vue**：

```javascript
// 检查验证结果
if (!skipVerify && newAccount.verifyResult) {
  const { imap, smtp, errors } = newAccount.verifyResult
  
  if (imap && smtp) {
    message.success('账户添加成功，连接验证通过')
  } else {
    // 更详细的错误信息
    let errorDetails = []
    
    if (!imap) {
      errorDetails.push('IMAP连接失败')
      if (errors.find(e => e.includes('IMAP'))) {
        errorDetails.push('请检查：')
        errorDetails.push('1. 是否已在QQ邮箱网页版开启IMAP服务')
        errorDetails.push('2. 是否使用授权码（非登录密码）')
        errorDetails.push('3. 授权码是否正确')
      }
    }
    
    if (!smtp) {
      errorDetails.push('SMTP连接失败')
      if (errors.find(e => e.includes('SMTP'))) {
        errorDetails.push('请检查：')
        errorDetails.push('1. 是否已在QQ邮箱网页版开启SMTP服务')
        errorDetails.push('2. 是否使用授权码（非登录密码）')
      }
    }
    
    const errorMsg = errors.join('; ')
    
    // 使用 Modal 显示详细错误
    Modal.warning({
      title: '账户已添加，但连接验证失败',
      content: h('div', [
        h('p', { style: 'color: #ff4d4f; margin-bottom: 8px;' }, `错误信息：${errorMsg}`),
        h('div', { style: 'margin-top: 12px;' }, errorDetails.map(detail => 
          h('div', { style: 'margin-bottom: 4px;' }, detail)
        ))
      ]),
      okText: '我知道了',
    })
  }
}
```

### 方案2：增强授权码提示

**修改 Login.vue 的提示**：

```vue
<a-alert
  v-if="formData.type === 'qq'"
  message="QQ邮箱需要使用授权码"
  type="warning"
  show-icon
>
  <template #description>
    <div>
      <p><strong>请按以下步骤操作：</strong></p>
      <ol style="margin: 8px 0; padding-left: 20px;">
        <li>登录 <a href="https://mail.qq.com" target="_blank">QQ邮箱网页版</a></li>
        <li>进入「设置」→「账户」</li>
        <li>找到「POP3/IMAP/SMTP服务」</li>
        <li>开启「IMAP/SMTP服务」</li>
        <li>生成授权码并保存（16位字符）</li>
        <li>在下方输入框中填写授权码</li>
      </ol>
      <p style="color: #ff4d4f;">注意：授权码不是QQ密码或邮箱密码！</p>
    </div>
  </template>
</a-alert>
```

### 方案3：添加连接测试功能

**添加测试连接按钮**：

```vue
<a-form-item v-if="!isOAuth2" label="授权码/密码" name="password">
  <a-input-password 
    v-model:value="formData.password" 
    placeholder="请输入授权码或密码"
  >
    <template #suffix>
      <a-button 
        type="link" 
        size="small"
        @click="handleTestConnection"
        :loading="testing"
      >
        测试连接
      </a-button>
    </template>
  </a-input-password>
</a-form-item>
```

```javascript
const testing = ref(false)

async function handleTestConnection() {
  try {
    await formRef.value.validateFields(['email', 'password'])
    
    testing.value = true
    const config = emailConfigs[formData.type]
    
    const testAccount = {
      email: formData.email,
      password: formData.password,
      ...config,
    }
    
    const result = await accountStore.verifyAccount(testAccount)
    
    if (result.imap && result.smtp) {
      message.success('连接测试成功！')
    } else {
      const errors = result.errors.join('; ')
      message.error(`连接测试失败：${errors}`)
    }
  } catch (error) {
    message.error(`测试失败：${error.message}`)
  } finally {
    testing.value = false
  }
}
```

### 方案4：改进验证失败后的处理

**选项A：验证失败仍然添加账户（当前行为）**
- ✅ 优点：用户可以先添加账户，之后再修复问题
- ❌ 缺点：可能导致用户困惑，不知道为什么无法收发邮件

**选项B：验证失败拒绝添加账户**
- ✅ 优点：确保添加的账户都是可用的
- ❌ 缺点：可能会让用户感到挫败

**推荐：选项C - 验证失败询问用户**

```javascript
if (!imap || !smtp) {
  const errorMsg = errors.join('; ')
  
  // 询问用户是否继续
  const confirmed = await new Promise((resolve) => {
    Modal.confirm({
      title: '连接验证失败',
      content: h('div', [
        h('p', `错误信息：${errorMsg}`),
        h('p', { style: 'margin-top: 12px;' }, '是否仍然添加此账户？'),
        h('p', { style: 'color: #8c8c8c; font-size: 12px;' }, '您可以稍后在设置中修复连接问题'),
      ]),
      okText: '仍然添加',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
  
  if (!confirmed) {
    // 用户取消，移除已添加的账户
    await accountStore.deleteAccount(newAccount.id)
    return
  }
}
```

## 排查步骤

### 用户侧排查

1. **确认已开启IMAP/SMTP服务**
   - 登录 QQ 邮箱网页版
   - 检查「设置」→「账户」→「POP3/IMAP/SMTP服务」

2. **确认使用授权码**
   - 授权码是 16 位字符
   - 不是 QQ 密码或邮箱密码
   - 如果忘记授权码，可以重新生成

3. **检查网络连接**
   - 确保可以访问 `imap.qq.com` 和 `smtp.qq.com`
   - 如果使用代理，确保代理配置正确

### 开发侧排查

1. **查看控制台日志**
   ```
   [Account] IMAP verification failed: ...
   [Account] SMTP verification failed: ...
   ```

2. **查看 Electron 主进程日志**
   ```
   [IMAP] Connecting to imap.qq.com:993
   [IMAP] Connection error: ...
   [SMTP] SMTP verification failed: ...
   ```

3. **检查是否在浏览器模式**
   - 浏览器模式不会真正连接服务器
   - 必须在 Electron 环境中测试

## 测试建议

### 测试用例1：正常添加QQ邮箱

**前置条件**：
- 已在 QQ 邮箱网页版开启 IMAP/SMTP 服务
- 已生成授权码

**步骤**：
1. 点击「添加邮箱账户」
2. 选择「QQ邮箱」
3. 输入邮箱地址：`your_email@qq.com`
4. 输入授权码
5. 点击「确定」

**预期结果**：
- 显示「正在验证账户连接...」
- 显示「账户添加成功，连接验证通过」
- 自动登录到收件箱

### 测试用例2：使用错误的授权码

**步骤**：
1. 输入正确的邮箱地址
2. 输入错误的授权码
3. 点击「确定」

**预期结果**：
- 显示「账户已添加，但连接验证失败」
- 显示具体的错误信息（IMAP/SMTP认证失败）
- 给出解决建议

### 测试用例3：未开启IMAP服务

**步骤**：
1. 使用未开启 IMAP 服务的 QQ 邮箱
2. 输入正确的邮箱和授权码
3. 点击「确定」

**预期结果**：
- 显示 IMAP 连接失败
- 提示检查是否已开启 IMAP 服务

## 常见错误信息

### 1. Invalid credentials
```
IMAP: Error: Invalid credentials (Failure)
```
**原因**：
- 使用了登录密码而非授权码
- 授权码错误
- 邮箱地址错误

**解决方法**：
- 确认使用的是授权码
- 重新生成授权码
- 检查邮箱地址拼写

### 2. Connection timeout
```
IMAP: Error: Connection timeout
```
**原因**：
- 网络连接问题
- 防火墙阻止连接
- 代理配置错误

**解决方法**：
- 检查网络连接
- 检查防火墙设置
- 检查代理配置

### 3. TLS/SSL error
```
IMAP: Error: unable to verify the first certificate
```
**原因**：
- SSL 证书验证失败（已通过 `rejectUnauthorized: false` 禁用）

**解决方法**：
- 当前配置已禁用严格验证，不应出现此错误
- 如果仍然出现，检查 TLS 配置

### 4. Authentication failed
```
SMTP: Error: Invalid login: 535 Error: authentication failed
```
**原因**：
- SMTP 认证失败
- 通常与 IMAP 相同的原因

**解决方法**：
- 同 IMAP 认证失败的解决方法

## 相关文件

- `src/views/Login.vue` - 登录页面，账户添加 UI
- `src/stores/account.js` - 账户管理，验证逻辑
- `src/services/imap.js` - IMAP 服务（渲染进程）
- `src/services/smtp.js` - SMTP 服务（渲染进程）
- `electron/services/imap-main.js` - IMAP 服务（主进程）
- `electron/services/smtp-main.js` - SMTP 服务（主进程）
- `electron/main.js` - IPC 处理器

## 总结

QQ邮箱添加失败的主要原因是：

1. **用户未开启IMAP/SMTP服务** - 最常见
2. **使用登录密码而非授权码** - 最常见
3. **授权码错误** - 常见
4. **网络连接问题** - 偶尔
5. **错误提示不够明确** - 导致用户困惑

**推荐的修复优先级**：
1. ✅ 增强授权码提示（方案2）- 预防性措施
2. ✅ 增强错误提示（方案1）- 帮助用户诊断问题
3. ⭕ 添加连接测试功能（方案3）- 改进用户体验
4. ⭕ 改进验证失败处理（方案4）- 进一步优化

当前代码的验证逻辑是正确的，主要问题在于用户侧的配置和错误提示的明确性。
