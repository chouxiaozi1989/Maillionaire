# Maillionaire - UI交互时序图

## 1. 用户登录与账户管理流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 登录界面
    participant Auth as 认证模块
    participant IMAP as IMAP服务
    participant OAuth as OAuth2服务
    participant Store as 本地存储

    U->>UI: 打开应用
    UI->>Store: 加载已保存账户
    Store-->>UI: 返回账户列表
    
    alt 首次使用
        U->>UI: 点击"添加账户"
        UI->>U: 显示邮箱类型选择
        U->>UI: 选择邮箱类型(Gmail/QQ/163等)
        
        alt Gmail/Outlook (OAuth2)
            UI->>OAuth: 发起OAuth2认证
            OAuth-->>U: 跳转授权页面
            U->>OAuth: 同意授权
            OAuth-->>Auth: 返回Token
            Auth->>Store: 保存Token
        else QQ/163/126 (IMAP)
            UI->>U: 显示配置表单
            U->>UI: 输入邮箱地址、授权码
            UI->>Auth: 验证凭据
            Auth->>IMAP: 测试连接
            IMAP-->>Auth: 连接成功
            Auth->>Store: 保存账户配置
        end
        
        Store-->>UI: 保存成功
        UI->>U: 跳转主界面
    else 已有账户
        U->>UI: 选择账户登录
        UI->>Auth: 验证账户
        Auth->>IMAP: 建立连接
        IMAP-->>UI: 连接成功
        UI->>U: 跳转主界面
    end
```

## 2. 邮件收取流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 邮件列表界面
    participant Sync as 同步模块
    participant IMAP as IMAP服务器
    participant Store as 本地存储
    participant Cache as 缓存层

    U->>UI: 进入收件箱
    UI->>Cache: 检查本地缓存
    Cache-->>UI: 返回缓存数据
    UI->>U: 显示邮件列表(缓存)
    
    UI->>Sync: 后台同步最新邮件
    Sync->>IMAP: FETCH邮件(按日期/数量)
    IMAP-->>Sync: 返回邮件列表
    
    loop 处理每封邮件
        Sync->>IMAP: 获取邮件详情
        IMAP-->>Sync: 返回邮件内容
        Sync->>Store: 保存到本地
        Sync->>Cache: 更新缓存
    end
    
    Sync-->>UI: 同步完成通知
    UI->>Cache: 刷新列表
    Cache-->>UI: 返回最新数据
    UI->>U: 更新显示
    
    alt 用户筛选
        U->>UI: 选择筛选条件(日期/数量)
        UI->>Cache: 按条件查询
        Cache-->>UI: 返回筛选结果
        UI->>U: 显示筛选后列表
    end
```

## 3. 邮件发送流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant Compose as 撰写界面
    participant Editor as 富文本编辑器
    participant SMTP as SMTP服务
    participant Store as 本地存储
    participant Template as 模板模块

    U->>Compose: 点击"写邮件"
    Compose->>U: 显示撰写窗口
    
    alt 使用模板
        U->>Compose: 选择模板
        Compose->>Template: 加载模板内容
        Template-->>Editor: 填充模板
    end
    
    U->>Editor: 输入收件人
    Editor->>Store: 查询通讯录
    Store-->>Editor: 返回匹配联系人
    Editor->>U: 显示自动完成建议
    
    U->>Editor: 编辑邮件内容
    U->>Editor: 添加附件
    
    alt 应用签名
        U->>Compose: 选择签名
        Compose->>Store: 加载签名
        Store-->>Editor: 插入签名
    end
    
    U->>Compose: 点击"发送"
    Compose->>Compose: 验证表单
    
    alt 验证失败
        Compose->>U: 显示错误提示
    else 验证成功
        Compose->>SMTP: 发送邮件
        SMTP-->>Compose: 发送成功
        Compose->>Store: 保存到已发送
        Compose->>U: 显示成功提示
        Compose->>Compose: 关闭窗口
    end
    
    alt 保存草稿
        U->>Compose: 点击"保存草稿"
        Compose->>Store: 保存到草稿箱
        Store-->>U: 保存成功提示
    end
```

## 4. 邮件删除与同步流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 邮件列表
    participant Sync as 同步模块
    participant IMAP as IMAP服务器
    participant Store as 本地存储

    U->>UI: 选择邮件
    U->>UI: 点击"删除"
    UI->>U: 确认删除提示
    U->>UI: 确认
    
    UI->>Store: 移至回收站(本地)
    Store-->>UI: 本地删除成功
    UI->>U: 更新列表显示
    
    UI->>Sync: 触发服务器同步
    Sync->>IMAP: STORE命令(标记删除)
    IMAP-->>Sync: 标记成功
    
    alt 永久删除
        U->>UI: 在回收站中永久删除
        UI->>Store: 删除本地文件
        Store-->>UI: 删除成功
        UI->>Sync: 同步到服务器
        Sync->>IMAP: EXPUNGE命令
        IMAP-->>Sync: 永久删除成功
        Sync-->>UI: 同步完成
    end
    
    UI->>U: 显示删除成功
```

## 5. 文件夹同步流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 界面
    participant Sync as 同步模块
    participant IMAP as IMAP服务器
    participant Store as 本地存储

    U->>UI: 点击"同步文件夹"
    UI->>Sync: 发起同步请求
    
    Sync->>IMAP: LIST命令(获取文件夹列表)
    IMAP-->>Sync: 返回服务器文件夹
    
    Sync->>Store: 读取本地文件夹
    Store-->>Sync: 返回本地文件夹
    
    Sync->>Sync: 对比差异
    
    loop 处理新增文件夹
        Sync->>Store: 创建本地文件夹
        Store-->>Sync: 创建成功
    end
    
    loop 处理删除文件夹
        Sync->>Store: 删除本地文件夹
        Store-->>Sync: 删除成功
    end
    
    loop 同步每个文件夹内容
        Sync->>IMAP: SELECT文件夹
        IMAP-->>Sync: 切换成功
        Sync->>IMAP: SEARCH(查询邮件UID)
        IMAP-->>Sync: 返回UID列表
        Sync->>Sync: 对比本地UID
        Sync->>IMAP: FETCH新邮件
        IMAP-->>Sync: 返回邮件数据
        Sync->>Store: 保存邮件
    end
    
    Sync-->>UI: 同步完成
    UI->>U: 显示同步结果
    UI->>UI: 刷新文件夹树
```

## 6. 邮件详情查看流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant List as 邮件列表
    participant Modal as 详情弹窗
    participant Store as 本地存储
    participant IMAP as IMAP服务器
    participant Parser as HTML解析器

    U->>List: 点击邮件
    List->>Modal: 打开详情弹窗
    Modal->>Store: 读取邮件内容
    
    alt 本地已缓存
        Store-->>Modal: 返回完整内容
    else 仅有邮件头
        Store-->>Modal: 返回基本信息
        Modal->>U: 显示加载中
        Modal->>IMAP: FETCH完整邮件体
        IMAP-->>Modal: 返回邮件内容
        Modal->>Store: 更新本地缓存
    end
    
    Modal->>Parser: 解析HTML内容
    Parser-->>Modal: 返回安全HTML
    Modal->>U: 渲染富文本内容
    
    alt 有附件
        Modal->>U: 显示附件列表
        U->>Modal: 点击下载附件
        Modal->>Store: 检查本地缓存
        alt 未缓存
            Modal->>IMAP: 下载附件
            IMAP-->>Modal: 返回附件数据
            Modal->>Store: 保存附件
        end
        Store-->>U: 下载完成
    end
    
    alt 用户操作
        U->>Modal: 点击"回复"
        Modal->>List: 关闭弹窗
        List->>Compose: 打开撰写窗口(带引用)
    end
    
    Modal->>IMAP: 标记为已读
    IMAP-->>Modal: 更新成功
    Modal->>Store: 更新本地状态
```

## 7. 模板与签名管理流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 设置界面
    participant Editor as 富文本编辑器
    participant Store as 本地存储

    U->>UI: 进入"模板管理"
    UI->>Store: 读取模板列表
    Store-->>UI: 返回模板数据
    UI->>U: 显示模板列表
    
    alt 创建模板
        U->>UI: 点击"新建模板"
        UI->>Editor: 打开编辑器
        U->>Editor: 输入模板名称
        U->>Editor: 编辑模板内容
        U->>Editor: 设置分类
        U->>UI: 点击"保存"
        UI->>Store: 保存模板
        Store-->>UI: 保存成功
        UI->>U: 刷新列表
    end
    
    alt 管理签名
        U->>UI: 切换到"签名管理"
        UI->>Store: 读取签名列表
        Store-->>UI: 返回签名数据
        UI->>U: 显示签名列表
        
        U->>UI: 创建/编辑签名
        UI->>Editor: 打开富文本编辑器
        U->>Editor: 编辑签名内容
        U->>UI: 设置为默认签名
        U->>UI: 保存
        UI->>Store: 保存签名配置
        Store-->>UI: 保存成功
    end
```

## 8. 通讯录管理流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant UI as 通讯录界面
    participant Form as 表单组件
    participant Store as 本地存储
    participant Email as 邮件模块

    U->>UI: 进入通讯录
    UI->>Store: 读取联系人列表
    Store-->>UI: 返回联系人数据
    UI->>U: 显示联系人列表
    
    alt 添加联系人
        U->>UI: 点击"添加联系人"
        UI->>Form: 显示表单
        U->>Form: 填写信息(姓名、邮箱、电话等)
        U->>Form: 选择分组
        U->>UI: 提交
        UI->>UI: 验证邮箱格式
        UI->>Store: 保存联系人
        Store-->>UI: 保存成功
        UI->>U: 刷新列表
    end
    
    alt 搜索联系人
        U->>UI: 输入搜索关键词
        UI->>Store: 模糊查询
        Store-->>UI: 返回匹配结果
        UI->>U: 显示搜索结果
    end
    
    alt 快速发邮件
        U->>UI: 点击联系人
        UI->>U: 显示详情
        U->>UI: 点击"发邮件"
        UI->>Email: 打开撰写窗口
        Email->>Email: 自动填充收件人
    end
    
    alt 导入/导出
        U->>UI: 点击"导入"
        UI->>U: 选择CSV文件
        U->>UI: 确认导入
        UI->>Store: 批量保存
        Store-->>UI: 导入完成
        
        U->>UI: 点击"导出"
        UI->>Store: 读取所有联系人
        Store-->>UI: 返回数据
        UI->>U: 下载CSV文件
    end
```

## 9. 本地数据存储交互流程

```mermaid
sequenceDiagram
    participant App as 应用
    participant Store as 存储模块
    participant FS as 文件系统
    participant Encrypt as 加密模块

    App->>Store: 初始化存储
    Store->>FS: 检查数据目录
    
    alt 目录不存在
        FS->>FS: 创建目录结构
        FS-->>Store: 创建成功
    end
    
    alt 保存数据
        App->>Store: 保存账户配置
        Store->>Encrypt: 加密敏感信息
        Encrypt-->>Store: 返回加密数据
        Store->>FS: 写入JSON文件
        FS-->>Store: 写入成功
        Store-->>App: 保存完成
    end
    
    alt 读取数据
        App->>Store: 读取邮件数据
        Store->>FS: 读取JSON文件
        FS-->>Store: 返回文件内容
        Store->>Encrypt: 解密敏感字段
        Encrypt-->>Store: 返回明文
        Store-->>App: 返回数据对象
    end
    
    alt 定期清理
        App->>Store: 触发清理任务
        Store->>FS: 扫描旧数据
        FS-->>Store: 返回文件列表
        Store->>Store: 筛选过期数据
        Store->>FS: 删除文件
        FS-->>Store: 删除成功
        Store-->>App: 清理完成
    end
```

## 10. 应用启动流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant Electron as Electron主进程
    participant Window as 渲染进程
    participant Store as 存储模块
    participant Config as 配置模块
    participant Auth as 认证模块

    User->>Electron: 启动应用
    Electron->>Electron: 创建主窗口
    Electron->>Window: 加载Vue应用
    
    Window->>Config: 读取应用配置
    Config->>Store: 读取config.json
    Store-->>Config: 返回配置
    Config-->>Window: 配置加载完成
    
    Window->>Store: 读取账户列表
    Store-->>Window: 返回账户数据
    
    alt 无账户
        Window->>User: 显示欢迎页
        User->>Window: 添加账户
    else 有账户
        Window->>Auth: 验证账户Token
        
        alt Token有效
            Auth-->>Window: 验证成功
            Window->>User: 显示主界面
            Window->>Window: 自动同步邮件
        else Token过期
            Auth-->>Window: 验证失败
            Window->>User: 显示重新登录提示
        end
    end
```

---

**文档版本**: v1.0  
**创建日期**: 2025-10-19  
**说明**: 本文档包含Maillionaire邮件客户端的核心功能交互时序图，展示了用户操作、系统模块、外部服务之间的交互流程。
