# QQ邮箱邮件内容为空问题修复

## 问题描述

使用QQ邮箱（IMAP协议）获取邮件时，邮件列表中的邮件内容（body字段）为空，只能看到标题、发件人等基本信息，无法查看邮件正文。

## 问题原因

### 根本原因：竞态条件（Race Condition）

在 `electron/services/imap-main.js` 的 `fetchAndParseMails` 方法中存在一个竞态条件问题：

```javascript
// 旧代码（有问题）
msg.on('body', async (stream, info) => {
  // 异步解析邮件
  const parsed = await simpleParser(stream);
  mailData.parsed = { ... };
});

msg.once('end', () => {
  // ⚠️ 这里可能在异步解析完成之前就触发
  mails.push(mailData);  // mailData.parsed 可能还是 null
});
```

**问题流程：**
1. IMAP 触发 `body` 事件，开始异步解析邮件
2. 在解析完成之前，`end` 事件就已经触发
3. `mailData` 被推入结果数组时，`mailData.parsed` 还是 `null`
4. 最终返回到前端的邮件对象，`body` 字段为空

### 为什么会出现这个问题？

- `msg.on('body', async ...)` 是异步的
- `msg.once('end')` 是同步触发的
- `simpleParser` 需要时间解析邮件内容（特别是大邮件或复杂HTML）
- 两个事件没有同步机制

## 修复方案

### 实现同步机制

使用标志位和回调函数确保两个事件都完成后才处理邮件：

```javascript
fetch.on('message', (msg, seqno) => {
  const mailData = {
    uid: null,
    flags: [],
    parsed: null,
  };

  let bodyParsed = false;          // ✅ 标志位：body是否解析完成
  let attributesReceived = false;  // ✅ 标志位：attributes是否接收

  // ✅ 检查函数：只有两个都完成才处理
  const checkComplete = () => {
    if (bodyParsed && attributesReceived) {
      processedCount++;
      mails.push(mailData);
      console.log(`[IMAP] Processed ${processedCount}/${uids.length} mails`);
    }
  };

  msg.on('body', async (stream, info) => {
    try {
      const parsed = await simpleParser(stream);
      mailData.parsed = { ... };
      bodyParsed = true;         // ✅ 标记完成
      checkComplete();           // ✅ 检查是否可以推入数组
    } catch (error) {
      mailData.parsed = { ... };
      bodyParsed = true;
      checkComplete();
    }
  });

  msg.once('attributes', (attrs) => {
    mailData.uid = attrs.uid;
    mailData.flags = attrs.flags;
    attributesReceived = true;   // ✅ 标记完成
    checkComplete();             // ✅ 检查是否可以推入数组
  });
});
```

### 关键改进

1. **移除 `msg.once('end')` 事件处理**
   - 不再依赖 `end` 事件
   - 避免竞态条件

2. **添加标志位跟踪**
   - `bodyParsed`: 跟踪邮件体是否解析完成
   - `attributesReceived`: 跟踪邮件属性是否接收完成

3. **实现 `checkComplete()` 检查函数**
   - 只有两个标志位都为 `true` 时才推入结果数组
   - 确保 `mailData` 包含完整数据

4. **增强日志记录**
   - 记录解析状态
   - 显示邮件是否有内容
   - 便于调试

## 修改的文件

- `electron/services/imap-main.js` (第708-777行)

## 影响范围

### 受益的功能
- QQ邮箱邮件获取
- 所有IMAP协议的邮件服务（163、126、企业邮箱等）
- 邮件详情查看
- 邮件导出功能
- 邮件搜索和过滤

### 不影响的功能
- Gmail API 邮件获取（使用不同的实现）
- 邮件发送
- 账户管理

## 测试建议

### 1. 功能测试
```
✅ 连接QQ邮箱
✅ 获取邮件列表
✅ 查看邮件详情（检查body字段是否有内容）
✅ 查看包含图片的邮件
✅ 查看纯文本邮件
✅ 查看HTML邮件
```

### 2. 性能测试
```
✅ 获取10封邮件
✅ 获取50封邮件
✅ 获取100封邮件
✅ 检查内存使用
```

### 3. 边界测试
```
✅ 大邮件（>1MB）
✅ 包含大附件的邮件
✅ 包含多个附件的邮件
✅ 特殊编码的邮件（中文、emoji）
```

### 4. 错误测试
```
✅ 网络中断时的处理
✅ 邮件解析失败时的处理
✅ 超时的处理
```

## 使用方法

### QQ邮箱配置

1. **开启IMAP服务**
   - 登录QQ邮箱网页版
   - 设置 → 账户 → POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务
   - 开启IMAP/SMTP服务
   - 生成授权码（16位）

2. **在 Maillionaire 中添加账户**
   ```
   邮箱地址: your_qq@qq.com
   协议: IMAP
   IMAP服务器: imap.qq.com
   IMAP端口: 993
   SMTP服务器: smtp.qq.com
   SMTP端口: 465/587
   密码: 使用授权码（不是QQ密码）
   ```

3. **测试连接和获取**
   - 点击"测试连接"
   - 如果成功，点击"获取邮件"
   - 查看邮件列表
   - 点击邮件查看详情，检查内容是否正常显示

## 调试日志

修复后的代码会输出详细的调试信息：

```
[IMAP] Fetching and parsing 10 mails...
[IMAP] Parsing mail body for seqno: 1
[IMAP] Parsed mail - Subject: 测试邮件, Has HTML: true, Has Text: true
[IMAP] Processed 1/10 mails - UID: 12345, Subject: 测试邮件, Has content: true
...
[IMAP] Fetch completed, total 10 mails
```

关键信息：
- `Has HTML: true/false` - 是否有HTML内容
- `Has Text: true/false` - 是否有纯文本内容
- `Has content: true/false` - 是否有任何内容

## 其他IMAP邮箱配置

### 163邮箱
```
IMAP: imap.163.com:993
SMTP: smtp.163.com:465/994
需要授权码
```

### 126邮箱
```
IMAP: imap.126.com:993
SMTP: smtp.126.com:465/994
需要授权码
```

### 企业邮箱（腾讯）
```
IMAP: imap.exmail.qq.com:993
SMTP: smtp.exmail.qq.com:465
可使用密码或授权码
```

### Outlook/Hotmail
```
IMAP: outlook.office365.com:993
SMTP: smtp.office365.com:587
使用账户密码
```

## 注意事项

1. **授权码 vs 密码**
   - QQ邮箱、163、126 必须使用授权码
   - 授权码在邮箱设置中生成
   - 不要使用账户登录密码

2. **端口配置**
   - IMAP通常使用 993 (SSL)
   - SMTP可以使用 465 (SSL) 或 587 (TLS)

3. **安全连接**
   - 始终使用 SSL/TLS 加密连接
   - 在应用中启用"安全连接"选项

4. **代理设置**
   - 如果使用代理，确保支持IMAP协议
   - SOCKS5代理兼容性最好

## 版本信息

- 修复版本: 当前版本
- 影响版本: 所有之前版本
- 依赖库: mailparser@3.6.5, imap@0.8.19
- Node版本: 建议 v16+
- Electron版本: 26.6.10

## 相关问题

如果修复后仍然有问题，请检查：

1. **控制台日志**
   - 查看 `[IMAP]` 开头的日志
   - 确认是否有 "Has content: true"

2. **网络连接**
   - 测试IMAP服务器连接
   - 检查防火墙设置

3. **授权问题**
   - 确认授权码正确
   - 确认IMAP服务已开启

4. **邮件格式**
   - 某些特殊格式邮件可能解析失败
   - 查看错误日志

## 技术细节

### mailparser 库

使用 `mailparser` 的 `simpleParser` 方法解析邮件：

```javascript
const parsed = await simpleParser(stream);
// parsed 包含：
// - from, to, cc: 邮件地址
// - subject: 主题
// - date: 日期
// - text: 纯文本内容
// - html: HTML内容
// - textAsHtml: 将text转换为HTML
// - attachments: 附件数组
```

### IMAP fetch 参数

```javascript
this.connection.fetch(uids, {
  bodies: '',      // 空字符串 = 获取完整邮件
  struct: true,    // 获取邮件结构信息
});
```

## 参考资料

- [mailparser 文档](https://nodemailer.com/extras/mailparser/)
- [node-imap 文档](https://github.com/mscdex/node-imap)
- [QQ邮箱IMAP设置](https://service.mail.qq.com/cgi-bin/help?subtype=1&&id=28&&no=1000585)
- [RFC 3501 (IMAP协议)](https://tools.ietf.org/html/rfc3501)
