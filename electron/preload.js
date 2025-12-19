/**
 * Preload Script
 * 在渲染进程和主进程之间提供安全的通信桥梁
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用路径
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  
  // 文件系统操作
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, data) => ipcRenderer.invoke('write-file', path, data),
  deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
  
  // 邮件操作
  fetchEmails: (config) => ipcRenderer.invoke('fetch-emails', config),
  sendEmail: (config) => ipcRenderer.invoke('send-email', config),
  deleteEmail: (config) => ipcRenderer.invoke('delete-email', config),
  
  // SMTP 操作
  verifySmtp: (config) => ipcRenderer.invoke('verify-smtp', config),
  
  // IMAP 操作
  connectImap: (config) => ipcRenderer.invoke('connect-imap', config),
  disconnectImap: () => ipcRenderer.invoke('disconnect-imap'),
  getImapFolders: () => ipcRenderer.invoke('get-imap-folders'),
  openImapFolder: (folderName) => ipcRenderer.invoke('open-imap-folder', folderName),
  searchImapMails: (criteria) => ipcRenderer.invoke('search-imap-mails', criteria),
  fetchImapMails: (uids, options) => ipcRenderer.invoke('fetch-imap-mails', uids, options),
  markImapMailAsRead: (uid) => ipcRenderer.invoke('mark-imap-mail-as-read', uid),
  deleteImapMail: (uid) => ipcRenderer.invoke('delete-imap-mail', uid),
  moveImapMail: (uid, targetFolder) => ipcRenderer.invoke('move-imap-mail', uid, targetFolder),
  getServerFolders: () => ipcRenderer.invoke('get-server-folders'),
  createImapFolder: (folderName) => ipcRenderer.invoke('create-imap-folder', folderName),
  deleteImapFolder: (folderName) => ipcRenderer.invoke('delete-imap-folder', folderName),
  renameImapFolder: (oldName, newName) => ipcRenderer.invoke('rename-imap-folder', oldName, newName),
  copyImapMail: (uid, targetFolder) => ipcRenderer.invoke('copy-imap-mail', uid, targetFolder),
  fetchImapMails: (uids, options) => ipcRenderer.invoke('fetch-imap-mails', uids, options),
  fetchAndParseImapMails: (uids) => ipcRenderer.invoke('fetch-and-parse-imap-mails', uids),
  
  // 代理配置操作
  setProxyConfig: (config) => ipcRenderer.invoke('set-proxy-config', config),
  getProxyConfig: () => ipcRenderer.invoke('get-proxy-config'),
  testProxy: (config, testUrl) => ipcRenderer.invoke('test-proxy', config, testUrl),
  
  // OAuth2 操作
  oauth2ExchangeToken: (provider, code, config) => ipcRenderer.invoke('oauth2-exchange-token', { provider, code, config }),
  oauth2RefreshToken: (provider, refreshToken, config) => ipcRenderer.invoke('oauth2-refresh-token', { provider, refreshToken, config }),
  
  // Gmail API 操作
  gmailApiRequest: (url, options) => ipcRenderer.invoke('gmail-api-request', url, options),

  // 邮件导出操作
  exportMails: (mails, accounts) => ipcRenderer.invoke('export-mails', { mails, accounts }),

  // 导出进度监听
  onExportProgress: (callback) => {
    const listener = (event, progress) => callback(progress);
    ipcRenderer.on('export-progress', listener);
    // 返回清理函数
    return () => ipcRenderer.removeListener('export-progress', listener);
  },
});
