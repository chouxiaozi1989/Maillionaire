const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const smtpService = require('./services/smtp-main');
const imapService = require('./services/imap-main');
const isDev = !app.isPackaged;

/**
 * 创建主窗口
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../build/icon.png'),
  });

  // 开发环境加载vite服务器，生产环境加载打包后的文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    console.log('Main window closed');
  });
}

/**
 * 应用启动
 */
app.whenReady().then(() => {
  createWindow();

  // macOS特定：点击dock图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * 所有窗口关闭时退出应用（macOS除外）
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * IPC通信处理
 */

// 获取应用数据路径
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// 最小化窗口
ipcMain.on('window-minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window.minimize();
});

// 最大化/还原窗口
ipcMain.on('window-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window.isMaximized()) {
    window.restore();
  } else {
    window.maximize();
  }
});

// 关闭窗口
ipcMain.on('window-close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window.close();
});

/**
 * 文件系统操作
 */

// 读取文件
ipcMain.handle('read-file', async (event, filename) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // 文件不存在
    }
    throw error;
  }
});

// 写入文件
ipcMain.handle('write-file', async (event, filename, data) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename);
    const dir = path.dirname(filePath);
    
    // 确保目录存在
    await fs.mkdir(dir, { recursive: true });
    
    // 写入文件
    await fs.writeFile(filePath, data, 'utf-8');
    return true;
  } catch (error) {
    console.error('Write file error:', error);
    throw error;
  }
});

// 删除文件
ipcMain.handle('delete-file', async (event, filename) => {
  try {
    const filePath = path.join(app.getPath('userData'), filename);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true; // 文件不存在，视为删除成功
    }
    throw error;
  }
});

/**
 * SMTP 服务 IPC 处理器
 */
ipcMain.handle('verify-smtp', async (event, config) => {
  return await smtpService.verify(config);
});

ipcMain.handle('send-email', async (event, { config, mailOptions }) => {
  return await smtpService.sendMail(config, mailOptions);
});

/**
 * IMAP 服务 IPC 处理器
 */
ipcMain.handle('connect-imap', async (event, config) => {
  return await imapService.connect(config);
});

ipcMain.handle('disconnect-imap', async (event) => {
  return imapService.disconnect();
});

ipcMain.handle('get-imap-folders', async (event) => {
  return await imapService.getFolders();
});

ipcMain.handle('open-imap-folder', async (event, folderName) => {
  return await imapService.openFolder(folderName);
});

ipcMain.handle('search-imap-mails', async (event, criteria) => {
  return await imapService.searchMails(criteria);
});

ipcMain.handle('mark-imap-mail-as-read', async (event, uid) => {
  return await imapService.markAsRead(uid);
});

ipcMain.handle('delete-imap-mail', async (event, uid) => {
  return await imapService.deleteMail(uid);
});

ipcMain.handle('move-imap-mail', async (event, uid, targetFolder) => {
  return await imapService.moveMail(uid, targetFolder);
});

ipcMain.handle('get-server-folders', async (event) => {
  return await imapService.getServerFolders();
});

ipcMain.handle('create-imap-folder', async (event, folderName) => {
  return await imapService.createFolder(folderName);
});

ipcMain.handle('delete-imap-folder', async (event, folderName) => {
  return await imapService.deleteFolder(folderName);
});

ipcMain.handle('rename-imap-folder', async (event, oldName, newName) => {
  return await imapService.renameFolder(oldName, newName);
});

ipcMain.handle('copy-imap-mail', async (event, uid, targetFolder) => {
  return await imapService.copyMail(uid, targetFolder);
});
