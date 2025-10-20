# Maillionaire - UI设计图使用说明

## 📋 概述

本目录包含Maillionaire邮件客户端的UI设计原型文件（HTML格式）。这些原型文件可以直接在浏览器中打开预览，并截图保存为PNG格式作为最终的UI设计图。

---

## 📁 文件列表

### 1. `01-login-page.html` - 登录页面
**功能说明**:
- 展示账户选择界面
- 已有账户列表显示
- 添加新账户入口

**设计要点**:
- 渐变背景，视觉吸引力强
- 卡片式账户列表，清晰易读
- Logo采用邮件图标，品牌识别度高

**截图尺寸建议**: 1920×1080px

---

### 2. `02-main-interface.html` - 主界面
**功能说明**:
- 完整的三栏布局（侧边栏、邮件列表、预览面板）
- 顶部导航栏包含搜索、撰写等核心功能
- 左侧文件夹树形结构
- 中间邮件列表支持筛选和排序
- 右侧邮件预览面板

**设计要点**:
- 清晰的信息层级
- 未读邮件高亮显示
- 响应式布局设计
- 操作按钮位置合理

**截图尺寸建议**: 1920×1080px (全屏)

---

### 3. `03-compose-mail.html` - 撰写邮件
**功能说明**:
- 模态框形式的撰写窗口
- 收件人标签化输入
- 富文本编辑器工具栏
- 附件管理区域
- 模板和签名选项

**设计要点**:
- 工具栏图标清晰易懂
- 编辑区域足够大
- 附件卡片设计美观
- 底部操作按钮分组明确

**截图尺寸建议**: 1600×900px (模态框居中)

---

### 4. `04-contacts.html` - 通讯录
**功能说明**:
- 左侧分组列表
- 中间联系人卡片列表
- 右侧联系人详情面板
- 搜索和导入导出功能

**设计要点**:
- 三栏布局，信息展示充分
- 联系人卡片包含关键信息
- 详情面板分区清晰
- 操作按钮直观易用

**截图尺寸建议**: 1920×1080px

---

## 🎨 如何生成PNG设计图

### 方法一：使用浏览器截图（推荐）

1. **打开HTML文件**
   - 双击HTML文件，使用默认浏览器打开
   - 或右键 → 打开方式 → 选择浏览器（推荐Chrome/Edge）

2. **调整浏览器窗口**
   - 根据建议尺寸调整浏览器窗口大小
   - 按F11进入全屏模式（主界面和通讯录）
   - 模态框页面保持窗口模式

3. **截图保存**
   - **Windows**: 
     - 使用截图工具（Win + Shift + S）
     - 或使用浏览器截图插件
   - **Chrome浏览器**:
     - F12打开开发者工具
     - Ctrl + Shift + P
     - 输入 "screenshot"
     - 选择 "Capture full size screenshot"

4. **保存文件**
   - 保存为PNG格式
   - 命名规范：
     - `01-登录页面.png`
     - `02-主界面.png`
     - `03-撰写邮件.png`
     - `04-通讯录.png`

### 方法二：使用截图工具

**推荐工具**:
- **Snagit** (专业截图工具)
- **ShareX** (开源免费)
- **Lightshot** (轻量级)
- **Windows自带截图工具**

**操作步骤**:
1. 在浏览器中打开HTML文件
2. 调整窗口到合适尺寸
3. 使用截图工具捕获整个窗口
4. 保存为PNG格式

### 方法三：使用自动化工具（批量生成）

如果需要批量生成，可以使用Puppeteer（Node.js）:

```javascript
const puppeteer = require('puppeteer');
const path = require('path');

async function captureScreenshot(htmlFile, outputFile, viewport) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setViewport(viewport);
  await page.goto(`file://${path.resolve(htmlFile)}`);
  await page.screenshot({ 
    path: outputFile,
    fullPage: true 
  });
  
  await browser.close();
}

// 执行截图
captureScreenshot('./01-login-page.html', './screenshots/01-登录页面.png', 
  { width: 1920, height: 1080 });
captureScreenshot('./02-main-interface.html', './screenshots/02-主界面.png', 
  { width: 1920, height: 1080 });
captureScreenshot('./03-compose-mail.html', './screenshots/03-撰写邮件.png', 
  { width: 1600, height: 900 });
captureScreenshot('./04-contacts.html', './screenshots/04-通讯录.png', 
  { width: 1920, height: 1080 });
```

---

## 📐 设计规范参考

所有HTML设计原型严格遵循 `UI设计规范.md` 中定义的标准：

### 颜色
- 主色：#1890FF (蓝色)
- 成功：#52C41A (绿色)
- 警告：#FAAD14 (橙色)
- 错误：#F5222D (红色)

### 字体
- 字体家族：系统默认字体栈
- 主要字号：14px (正文)、16px (小标题)、20px (标题)

### 间距
- 基础单位：8px
- 页面边距：24px
- 组件间距：16px

### 圆角
- 按钮/输入框：4px
- 卡片/弹窗：8px
- 大卡片：12px

---

## 🔄 修改设计

如果需要修改设计，可以：

1. **编辑HTML文件**
   - 使用任何文本编辑器或IDE打开HTML文件
   - 修改`<style>`标签内的CSS样式
   - 修改`<body>`标签内的HTML结构

2. **修改建议**
   - 颜色修改：搜索颜色代码（如`#1890FF`）并替换
   - 文字修改：直接修改HTML标签内的文本内容
   - 布局调整：修改CSS中的宽度、高度、padding、margin等

3. **保存并预览**
   - 保存修改后的文件
   - 刷新浏览器查看效果
   - 满意后重新截图

---

## ✅ 设计检查清单

在生成最终PNG图片前，请确认：

- [ ] 所有文字清晰可读
- [ ] 颜色符合设计规范
- [ ] 间距和对齐统一
- [ ] 图标显示正常
- [ ] 没有明显的设计缺陷
- [ ] 截图尺寸符合要求
- [ ] 文件格式为PNG
- [ ] 文件命名规范

---

## 📝 注意事项

1. **浏览器兼容性**
   - 推荐使用Chrome、Edge、Firefox最新版本
   - 避免使用IE浏览器

2. **显示效果**
   - 确保显示器缩放比例为100%
   - 部分浏览器可能有抗锯齿差异

3. **文件大小**
   - PNG格式可能较大，可使用压缩工具优化
   - 推荐工具：TinyPNG、ImageOptim

4. **版本管理**
   - 建议保留原始HTML文件
   - 生成的PNG图片单独存放在`screenshots/`目录

---

## 📞 技术支持

如有问题，请参考：
- `UI设计规范.md` - 详细的设计规范
- `PRD-产品需求文档.md` - 功能需求说明
- `UI交互时序图.md` - 交互流程说明

---

**文档版本**: v1.0  
**创建日期**: 2025-10-19  
**维护者**: Maillionaire Design Team
