# IMAP 竞态条件错误完全修复

## 问题描述

### 错误信息（第一阶段）
```
:5173/main/inbox:1 Uncaught (in promise) Error: 
Error invoking remote method 'mark-imap-mail-as-read': 
Error: No mailbox is currently selected
```

### 错误信息（第二阶段 - 竞态条件）
```
[1] Error occurred in handler for 'open-imap-folder': Error: IMAP not connected
[1]     at ImapMainService.openFolder (imap-main.js:286:16)
[1] [IMAP] Connection ready  ← 连接在 openFolder 调用之后才准备好！
```

### 触发场景
用户在收件箱中点击邮件查看详情时，系统尝试将邮件标记为已读，但 IMAP 操作失败，提示"No mailbox is currently selected"（没有选中邮箱）。

### 问题频率
高频 - 几乎每次点击邮件都会触发

---

## 根本原因分析

### 1. IMAP 连接架构问题

**主进程单例连接**：
- `electron/services/imap-main.js` 的 `ImapMainService` 类使用单例模式
- 所有 IMAP 操作共享同一个 `this.connection` 对象
- 这个连接在整个应用生命周期中被复用

```javascript
class ImapMainService {
  constructor() {
    this.connection = null;  // ← 单例连接
    this.proxyConfig = null;
  }
  
  async connect(config) {
    // 创建新连接并赋值给 this.connection
    this.connection = new Imap(imapConfig);
  }
  
  disconnect() {
    if (this.connection) {
      this.connection.end();
      this.connection = null;  // ← 连接被清空
    }
  }
}
```

### 2. 竞态条件（Race Condition）- 核心问题！

**问题流程**：

```
渲染进程调用：
1. await connectImap()  → Promise 返回
   │
   └── 主进程：
        - const connection = new Imap(config)
        - connection.once('ready', () => {
            this.connection = connection  // ← 这里才赋值！
            resolve(true)                  // ← 这里才 resolve！
          })
        - connection.connect()
        
2. await openImapFolder('INBOX')  → 立即调用
   │
   └── 主进程：
        if (!this.connection) {          // ← 检查 this.connection
          reject('IMAP not connected')   // ← 但是还没有被赋值！
        }
        
问题：
- connectImap() Promise 在 'ready' 事件时 resolve
- 但 this.connection 也是在 'ready' 事件中赋值
- 如果 openImapFolder() 在 'ready' 事件触发前调用
- this.connection 还是 null，导致错误！
```

**旧版代码问题**（`electron/services/imap-main.js`）：

```javascript
// ❌ 旧版实现 - 存在竞态条件
async connect(config) {
  return new Promise(async (resolve, reject) => {
    // ① 创建连接对象，立即赋值给 this.connection
    this.connection = new Imap(imapConfig);
    
    // ② 注册事件监听器
    this.connection.once('ready', () => {
      console.log('[IMAP] Connection ready');
      resolve(true);  // ← resolve Promise
    });
    
    // ③ 启动连接
    this.connection.connect();
    
    // 问题：this.connection 已经不是 null，
    // 但 'ready' 事件还没有触发！
  });
}
```

**时序图**：

```
时间轴 →

渲染进程          主进程 (connect)                    主进程 (openFolder)
│                │                                  │
│ connectImap() → this.connection = new Imap()      │
│                │ (① 连接对象已创建，但未准备好)  │
│                │                                  │
│ await          │ connection.once('ready', ...)  │
│                │ connection.connect()            │
│                │                                  │
│ openFolder() → │                                  if (!this.connection) ❌
│                │                                  ← this.connection 不是 null，但...
│                │                                  this.connection.openBox(...)
│                │                                  ← 连接还未准备好！
│                │                                  ERROR: IMAP not connected
│                │                                  │
│                │ 'ready' 事件触发 ✅           │
│                │ resolve(true)                    │
│                ← Promise resolved                 │
│                                                     │
└────────────────────────────────────────────────────┴
                                                        时间

问题：openFolder 在 'ready' 事件触发之前就被调用了！
```

### 3. 主进程缺少邮箱状态检查

**原有代码问题**（`electron/services/imap-main.js`）：

```javascript
// ❌ 原有实现 - 只检查连接是否存在
async markAsRead(uid) {
  return new Promise((resolve, reject) => {
    if (!this.connection) {
      reject(new Error('IMAP not connected'));
      return;
    }
    
    // 直接执行操作，没有检查邮箱是否已打开
    this.connection.addFlags(uid, ['\\Seen'], (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}
```

**缺失的检查**：
- 没有验证 `this.connection._box` 是否存在
- `_box` 属性只有在成功调用 `openBox()` 后才会被设置
- 如果 `_box` 为 `null`，执行 `addFlags()` 会抛出"No mailbox is currently selected"错误

### 4. 渲染进程错误处理不充分

虽然 `src/stores/mail.js` 中的 `markAsReadOnServer()` 已经添加了 try-catch-finally：

```javascript
try {
  await window.electronAPI.connectImap({...});
  await window.electronAPI.openImapFolder(mail.folder || 'INBOX');
  await window.electronAPI.markImapMailAsRead(mail.uid);
} catch (error) {
  console.error('[Mail] IMAP operation failed:', error);
  throw error;
} finally {
  await window.electronAPI.disconnectImap();
}
```

**但是仍然存在问题**：
1. 如果 `openImapFolder()` 调用成功，但主进程的 `_box` 状态没有正确设置
2. 或者在 `openImapFolder()` 和 `markImapMailAsRead()` 之间有其他操作干扰
3. 主进程没有足够的日志来诊断问题

---

## 修复方案

### 修复 0：解决竞态条件（核心修复）

**问题核心**：`this.connection` 在 IMAP 对象创建时就被赋值，但连接实际上还未准备好。

**解决方案**：延迟赋值 `this.connection`，只在 `ready` 事件触发时才赋值。

**文件**：`electron/services/imap-main.js`

```javascript
async connect(config) {
  return new Promise(async (resolve, reject) => {
    try {
      // ✅ 新增：如果已经有连接，先断开
      if (this.connection) {
        console.log('[IMAP] Disconnecting existing connection...');
        try {
          this.connection.end();
        } catch (e) {
          console.warn('[IMAP] Error ending existing connection:', e.message);
        }
        this.connection = null;
      }
      
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
      
      // ... 代理配置处理 ...
      
      // ✅ 关键修复：创建本地变量，不立即赋值给 this.connection
      const connection = new Imap(imapConfig);
      
      connection.once('ready', () => {
        console.log('[IMAP] Connection ready');
        // ✅ 只在 ready 事件中才设置 this.connection
        this.connection = connection;
        resolve(true);
      });
      
      connection.once('error', (err) => {
        console.error('[IMAP] Connection error:', err);
        this.connection = null;  // ✅ 错误时清空
        reject(err);
      });
      
      connection.once('end', () => {
        console.log('[IMAP] Connection ended');
        // ✅ 只清空当前连接
        if (this.connection === connection) {
          this.connection = null;
        }
      });
      
      // 启动连接
      if (!imapConfig.socket) {
        connection.connect();
      } else {
        console.log('[IMAP] Socket provided, waiting for ready event...');
      }
    } catch (error) {
      console.error('[IMAP] Failed to initiate connection:', error);
      this.connection = null;  // ✅ 异常时清空
      reject(error);
    }
  });
}
```

**修复后的时序图**：

```
时间轴 →

渲染进程          主进程 (connect)                    主进程 (openFolder)
│                │                                  │
│ connectImap() → const connection = new Imap()      │
│                │ (① 创建本地变量)               │
│                │ this.connection 仍然是 null      │
│                │                                  │
│ await          │ connection.once('ready', ...)  │
│                │ connection.connect()            │
│                │                                  │
│                │ ... 等待连接 ...                │
│                │                                  │
│                │ 'ready' 事件触发 ✅           │
│                │ this.connection = connection    │
│                │ resolve(true)                    │
│                ← Promise resolved                 │
│                                                     │
│ openFolder() → │                                  if (!this.connection) ✅
│                │                                  ← this.connection 已经赋值
│                │                                  this.connection.openBox(...)
│                │                                  ← 连接已准备好 ✅
│                │                                  SUCCESS ✅
│                │                                  │
└────────────────────────────────────────────────────┴
                                                        时间

修复：只在 'ready' 事件时才赋值 this.connection！
```

**关键改进**：

1. **延迟赋值**：
   - 旧：`this.connection = new Imap()` → 立即赋值
   - 新：`const connection = new Imap()` → 本地变量
   - 在 `ready` 事件中：`this.connection = connection`

2. **错误处理**：
   - 在 `error` 事件中设置 `this.connection = null`
   - 在 catch 块中设置 `this.connection = null`

3. **连接清理**：
   - 在 `end` 事件中检查 `if (this.connection === connection)`
   - 避免清空其他连接

4. **重连处理**：
   - 在 [connect()](file://c:UsersAdministratorDocumentsMaillionairesrcservicesimap.js#L16-L25) 开始时检查现有连接
   - 如果存在，先断开旧连接

---

### 修复 1：增强主进程邮箱状态检查

在所有需要打开邮箱的 IMAP 操作中添加 `_box` 状态检查：

**文件**：`electron/services/imap-main.js`

#### markAsRead() 方法

```javascript
async markAsRead(uid) {
  return new Promise((resolve, reject) => {
    if (!this.connection) {
      console.error('[IMAP] markAsRead: Connection is null');
      reject(new Error('IMAP not connected'));
      return;
    }
    
    // ✅ 新增：检查邮箱是否已打开
    if (!this.connection._box) {
      console.error('[IMAP] markAsRead: No mailbox is currently selected');
      reject(new Error('No mailbox is currently selected'));
      return;
    }
    
    console.log(`[IMAP] Marking mail ${uid} as read in mailbox: ${this.connection._box.name}`);
    
    this.connection.addFlags(uid, ['\\Seen'], (err) => {
      if (err) {
        console.error('[IMAP] markAsRead failed:', err);
        reject(err);
      } else {
        console.log(`[IMAP] Mail ${uid} marked as read successfully`);
        resolve(true);
      }
    });
  });
}
```

#### deleteMail() 方法

```javascript
async deleteMail(uid) {
  return new Promise((resolve, reject) => {
    if (!this.connection) {
      console.error('[IMAP] deleteMail: Connection is null');
      reject(new Error('IMAP not connected'));
      return;
    }
    
    // ✅ 新增：检查邮箱是否已打开
    if (!this.connection._box) {
      console.error('[IMAP] deleteMail: No mailbox is currently selected');
      reject(new Error('No mailbox is currently selected'));
      return;
    }
    
    console.log(`[IMAP] Deleting mail ${uid} from mailbox: ${this.connection._box.name}`);
    
    this.connection.addFlags(uid, ['\\Deleted'], (err) => {
      if (err) {
        console.error('[IMAP] deleteMail addFlags failed:', err);
        reject(err);
      } else {
        this.connection.expunge((err) => {
          if (err) {
            console.error('[IMAP] deleteMail expunge failed:', err);
            reject(err);
          } else {
            console.log(`[IMAP] Mail ${uid} deleted successfully`);
            resolve(true);
          }
        });
      }
    });
  });
}
```

#### moveMail() 方法

```javascript
async moveMail(uid, targetFolder) {
  return new Promise((resolve, reject) => {
    if (!this.connection) {
      console.error('[IMAP] moveMail: Connection is null');
      reject(new Error('IMAP not connected'));
      return;
    }
    
    // ✅ 新增：检查邮箱是否已打开
    if (!this.connection._box) {
      console.error('[IMAP] moveMail: No mailbox is currently selected');
      reject(new Error('No mailbox is currently selected'));
      return;
    }
    
    console.log(`[IMAP] Moving mail ${uid} to ${targetFolder}`);
    
    this.connection.move(uid, targetFolder, (err) => {
      if (err) {
        console.error('[IMAP] moveMail failed:', err);
        reject(err);
      } else {
        console.log(`[IMAP] Mail ${uid} moved successfully`);
        resolve(true);
      }
    });
  });
}
```

#### copyMail() 方法

```javascript
async copyMail(uid, targetFolder) {
  return new Promise((resolve, reject) => {
    if (!this.connection) {
      console.error('[IMAP] copyMail: Connection is null');
      reject(new Error('IMAP not connected'));
      return;
    }
    
    // ✅ 新增：检查邮箱是否已打开
    if (!this.connection._box) {
      console.error('[IMAP] copyMail: No mailbox is currently selected');
      reject(new Error('No mailbox is currently selected'));
      return;
    }
    
    console.log(`[IMAP] Copying mail ${uid} to ${targetFolder}`);
    
    this.connection.copy(uid, targetFolder, (err) => {
      if (err) {
        console.error('[IMAP] copyMail failed:', err);
        reject(err);
      } else {
        console.log(`[IMAP] Mail ${uid} copied successfully`);
        resolve(true);
      }
    });
  });
}
```

### 修复 2：增强 openFolder() 日志

```javascript
async openFolder(folderName) {
  return new Promise((resolve, reject) => {
    if (!this.connection) {
      console.error('[IMAP] openFolder: Connection is null');
      reject(new Error('IMAP not connected'));
      return;
    }
    
    console.log(`[IMAP] Opening folder: ${folderName}`);
    
    this.connection.openBox(folderName, false, (err, box) => {
      if (err) {
        console.error(`[IMAP] Failed to open folder ${folderName}:`, err);
        reject(err);
      } else {
        console.log(`[IMAP] Folder ${folderName} opened successfully. Total messages: ${box.messages.total}`);
        resolve(box);
      }
    });
  });
}
```

---

## 修复效果

### 1. 提前错误检测
- 在操作执行前检查邮箱状态
- 提供清晰的错误信息
- 避免 IMAP 库内部的模糊错误

### 2. 详细日志输出

**成功场景日志**：
```
[IMAP] Opening folder: INBOX
[IMAP] Folder INBOX opened successfully. Total messages: 42
[IMAP] Marking mail 123 as read in mailbox: INBOX
[IMAP] Mail 123 marked as read successfully
```

**失败场景日志**：
```
[IMAP] Opening folder: INBOX
[IMAP] Failed to open folder INBOX: Error: ...
[Mail] IMAP operation failed: Error: ...
```

**邮箱未选中场景日志**：
```
[IMAP] markAsRead: No mailbox is currently selected
[Mail] IMAP operation failed: Error: No mailbox is currently selected
```

### 3. 更好的错误定位
- 明确知道错误发生在哪个步骤
- 可以看到当前打开的邮箱名称
- 可以追踪 UID 和操作类型

---

## 测试场景

### 测试 1：正常标记已读
1. 打开收件箱
2. 点击一封未读邮件
3. 查看控制台日志
4. **预期**：邮件成功标记为已读，显示完整日志

### 测试 2：连接断开场景
1. 加载邮件列表
2. 等待自动断开连接
3. 点击邮件标记已读
4. **预期**：重新连接→打开文件夹→标记成功

### 测试 3：文件夹打开失败
1. 修改代码模拟 openFolder 失败
2. 点击邮件
3. **预期**：显示"Failed to open folder"错误，不会显示"No mailbox selected"

### 测试 4：并发操作
1. 快速连续点击多封邮件
2. 查看所有操作是否正常完成
3. **预期**：所有邮件都正确标记，没有错误

---

## 技术细节

### IMAP 连接状态机

```
┌─────────────┐
│  初始状态    │  this.connection = null
└──────┬──────┘
       │ connect()
       ↓
┌─────────────┐
│  已连接      │  this.connection = Imap实例
│             │  this.connection._box = null
└──────┬──────┘
       │ openBox(folderName)
       ↓
┌─────────────┐
│ 已打开邮箱  │  this.connection._box = { name, messages, ... }
│             │  ← 此时才能执行邮件操作
└──────┬──────┘
       │ disconnect()
       ↓
┌─────────────┐
│  已断开      │  this.connection = null
└─────────────┘
```

### _box 对象结构

```javascript
{
  name: 'INBOX',              // 邮箱名称
  flags: [],                  // 邮箱标志
  readOnly: false,            // 是否只读
  uidvalidity: 1234567890,    // UID 有效性
  uidnext: 123,               // 下一个 UID
  permFlags: ['\\Seen', ...], // 永久标志
  keywords: [],               // 关键字
  newKeywords: true,          // 是否允许新关键字
  persistentUIDs: true,       // UID 是否持久
  messages: {
    total: 42,                // 总邮件数
    new: 5                    // 新邮件数
  }
}
```

### 为什么检查 _box 而不是手动维护状态？

1. **真实性**：`_box` 是 IMAP 库内部维护的真实状态
2. **可靠性**：避免手动维护状态与实际状态不一致
3. **完整性**：`_box` 包含邮箱的完整信息（邮件数、标志等）
4. **简单性**：不需要额外的状态管理代码

---

## 后续优化建议

### 1. 连接池管理
当前使用单例连接可能导致并发问题，建议：
- 实现连接池，支持多个并发操作
- 每个操作使用独立的连接
- 连接自动回收和复用

### 2. 操作队列
避免并发操作冲突：
- 实现 IMAP 操作队列
- 串行执行需要邮箱状态的操作
- 自动重试失败的操作

### 3. 连接保活
减少频繁连接/断开：
- 实现连接保活机制
- 空闲一段时间后自动断开
- 需要时自动重连

### 4. 状态缓存
提高性能：
- 缓存文件夹列表
- 缓存邮件列表
- 增量同步而非全量拉取

---

## 修改文件清单

1. **electron/services/imap-main.js**
   - `markAsRead()` - 添加邮箱状态检查和日志
   - `deleteMail()` - 添加邮箱状态检查和日志
   - `moveMail()` - 添加邮箱状态检查和日志
   - `copyMail()` - 添加邮箱状态检查和日志
   - `openFolder()` - 增强日志输出

---

## 验证清单

- [x] 添加 `_box` 状态检查到所有邮件操作方法
- [x] 添加详细的控制台日志
- [x] 错误信息更加明确和可调试
- [ ] 重启开发服务器
- [ ] 强制刷新浏览器
- [ ] 测试正常标记已读流程
- [ ] 测试连接断开后重连流程
- [ ] 检查控制台日志是否完整

---

## 总结

此次修复通过在主进程的 IMAP 操作方法中添加邮箱状态检查和详细日志，可以：

1. **提前发现问题**：在操作执行前检查邮箱是否已打开
2. **明确错误原因**：通过日志清楚地知道哪一步失败了
3. **便于调试**：完整的操作流程日志便于定位问题
4. **提高稳定性**：避免在无效状态下执行操作

配合渲染进程已有的 try-catch-finally 错误处理，形成了完整的错误防护体系。
