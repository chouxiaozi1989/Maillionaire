const { app, BrowserWindow, ipcMain, session, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const smtpService = require('./services/smtp-main');
const imapService = require('./services/imap-main');
const exportService = require('./services/export-service');
const isDev = !app.isPackaged;

// 代理配置
let proxyConfig = null;

/**
 * 创建主窗口
 */
function createWindow() {
  // 隐藏窗口菜单栏
  Menu.setApplicationMenu(null);

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
    // 开发环境可以通过快捷键 Ctrl+Shift+I 打开开发者工具
  } else {
    // 使用 protocol 加载本地文件，确保路径正确
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('[Main] Loading index.html from:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    console.log('Main window closed');
  });

  // 监听加载失败事件
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Main] Failed to load:', errorCode, errorDescription);
  });
}

/**
 * 应用启动
 */
app.whenReady().then(async () => {
  createWindow();
  
  // 加载保存的代理配置
  try {
    const configPath = path.join(app.getPath('userData'), 'proxy-config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    proxyConfig = JSON.parse(configData);
    console.log('[Proxy] Loaded saved config:', proxyConfig?.enabled ? 'enabled' : 'disabled');
    
    // 应用到服务
    if (proxyConfig) {
      if (imapService) {
        imapService.setProxyConfig(proxyConfig);
      }
      if (smtpService) {
        smtpService.setProxyConfig(proxyConfig);
      }
      
      // 设置 Electron session 代理
      if (proxyConfig.enabled) {
        const { protocol, host, port } = proxyConfig;
        await session.defaultSession.setProxy({
          proxyRules: `${protocol}://${host}:${port}`,
          proxyBypassRules: 'localhost,127.0.0.1'
        });
        console.log('[Proxy] Proxy enabled on startup:', `${protocol}://${host}:${port}`);
      }
    }
  } catch (error) {
    // 配置文件不存在或解析失败，使用默认配置
    console.log('[Proxy] No saved config found, using defaults');
    proxyConfig = {
      enabled: false,
      protocol: 'http',
      host: '127.0.0.1',
      port: 7890,
      auth: { enabled: false, username: '', password: '' }
    };
  }

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

ipcMain.handle('fetch-imap-mails', async (event, uids, options) => {
  return await imapService.fetchMails(uids, options);
});

ipcMain.handle('fetch-and-parse-imap-mails', async (event, uids) => {
  return await imapService.fetchAndParseMails(uids);
});

/**
 * 代理配置 IPC 处理器
 */

// 设置代理配置
ipcMain.handle('set-proxy-config', async (event, config) => {
  try {
    proxyConfig = config;
    
    // 保存到文件
    const configPath = path.join(app.getPath('userData'), 'proxy-config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[Proxy] Config saved to:', configPath);
    
    // 应用代理到 IMAP 和 SMTP 服务
    if (imapService) {
      imapService.setProxyConfig(config);
    }
    if (smtpService) {
      smtpService.setProxyConfig(config);
    }
    
    // 设置 Electron session 代理
    if (config && config.enabled) {
      const { protocol, host, port, auth } = config;
      let proxyRules = `${protocol}://${host}:${port}`;
      
      await session.defaultSession.setProxy({
        proxyRules: proxyRules,
        proxyBypassRules: 'localhost,127.0.0.1'
      });
      
      console.log('[Proxy] Proxy enabled:', proxyRules);
    } else {
      // 禁用代理
      await session.defaultSession.setProxy({
        proxyRules: 'direct://'
      });
      console.log('[Proxy] Proxy disabled');
    }
    
    return { success: true };
  } catch (error) {
    console.error('[Proxy] Failed to set proxy config:', error);
    return { success: false, error: error.message };
  }
});

// 获取代理配置
ipcMain.handle('get-proxy-config', async () => {
  return proxyConfig;
});

// 测试代理连接
ipcMain.handle('test-proxy', async (event, config, testUrl = 'https://www.google.com') => {
  try {
    const https = require('https');
    const http = require('http');
    const { SocksProxyAgent } = require('socks-proxy-agent');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    const { protocol, host, port, auth } = config;
    let agent;
    
    // 构建代理 URL
    let proxyUrl;
    if (auth && auth.enabled && auth.username) {
      proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
    } else {
      proxyUrl = `${protocol}://${host}:${port}`;
    }
    
    // 根据协议创建代理 agent
    if (protocol.startsWith('socks')) {
      agent = new SocksProxyAgent(proxyUrl, {
        timeout: 30000,  // SOCKS 连接超时 30 秒
      });
    } else {
      agent = new HttpsProxyAgent(proxyUrl, {
        timeout: 30000,  // HTTP/HTTPS 代理连接超时 30 秒
      });
    }
    
    console.log('[Proxy] Testing connection via:', proxyUrl.replace(/:[^:@]+@/, ':***@'));
    console.log('[Proxy] Testing URL:', testUrl);
    
    // 如果是 HTTPS URL，先尝试 HTTP 版本的简单测试
    let shouldTryHttp = false;
    if (testUrl.startsWith('https://')) {
      const httpUrl = testUrl.replace('https://', 'http://');
      console.log('[Proxy] Will try HTTP first:', httpUrl);
      shouldTryHttp = true;
    }
    
    // 测试用户提供的 URL
    const testUrls = shouldTryHttp 
      ? [testUrl.replace('https://', 'http://'), testUrl]  // 先 HTTP 后 HTTPS
      : [testUrl];
    
    let lastError = null;
    
    for (const currentUrl of testUrls) {
      try {
        console.log('[Proxy] Trying URL:', currentUrl);
        
        const result = await new Promise((resolve, reject) => {
          const lib = currentUrl.startsWith('https') ? https : http;
          const url = new URL(currentUrl);
          
          const options = {
            hostname: url.hostname,
            port: url.port || (currentUrl.startsWith('https') ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            agent: agent,
            timeout: 30000, // 增加超时时间到 30 秒
            // 对于测试连接，我们禁用严格的 SSL 验证
            rejectUnauthorized: false,
            // 添加更多的 TLS 选项以兼容性
            secureOptions: require('constants').SSL_OP_NO_TLSv1 | require('constants').SSL_OP_NO_TLSv1_1,
          };
          
          const req = lib.request(options, (res) => {
            console.log('[Proxy] Response status:', res.statusCode, 'from', currentUrl);
            
            // 200, 204, 301, 302 都表示连接成功
            if ([200, 204, 301, 302, 400, 403].includes(res.statusCode)) {
              // 400 和 403 也算成功，因为说明代理连接已建立
              const isSuccess = [200, 204, 301, 302].includes(res.statusCode);
              resolve({ 
                success: isSuccess, 
                message: isSuccess ? `代理连接成功` : `服务器返回 HTTP ${res.statusCode}（代理连接已建立）`,
                status: res.statusCode,
                url: currentUrl 
              });
            } else {
              resolve({ 
                success: false, 
                message: `HTTP ${res.statusCode}`,
                status: res.statusCode,
                url: currentUrl 
              });
            }
            res.resume(); // 消费响应数据
          });
          
          req.on('error', (error) => {
            console.error('[Proxy] Request error for', currentUrl, ':', error.message);
            
            // 提供更友好的错误信息
            let friendlyMessage = error.message;
            if (error.message.includes('ECONNREFUSED')) {
              friendlyMessage = '代理服务器拒绝连接，请检查代理配置';
            } else if (error.message.includes('ENOTFOUND')) {
              friendlyMessage = '无法解析代理服务器地址';
            } else if (error.message.includes('TLS') || error.message.includes('SSL')) {
              friendlyMessage = 'TLS/SSL 握手失败，建议使用 HTTP URL 测试';
            } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
              friendlyMessage = '连接超时（30秒）';
            } else if (error.message.includes('socket disconnected')) {
              friendlyMessage = '代理连接中断，可能不支持 HTTPS 或配置有误';
            }
            
            reject(new Error(friendlyMessage));
          });
          
          req.on('timeout', () => {
            console.error('[Proxy] Request timeout for', currentUrl);
            req.destroy();
            reject(new Error('连接超时（30秒）'));
          });
          
          req.end();
        });
        
        console.log('[Proxy] Test result:', result);
        
        // 如果成功或者至少建立了连接（400/403），就返回
        if (result.success || [400, 403].includes(result.status)) {
          return result;
        }
        
        lastError = result.message;
        
      } catch (error) {
        console.error('[Proxy] Test failed for', currentUrl, ':', error.message);
        lastError = error.message;
        
        // 如果是最后一个 URL，返回错误
        if (currentUrl === testUrls[testUrls.length - 1]) {
          return { 
            success: false, 
            message: lastError || '连接失败' 
          };
        }
        
        // 否则继续尝试下一个 URL
        continue;
      }
    }
    
    // 所有尝试都失败
    return { 
      success: false, 
      message: lastError || '连接失败' 
    };
    
  } catch (error) {
    console.error('[Proxy] Test failed:', error);
    return { success: false, message: error.message };
  }
});

/**
 * OAuth2 Token 交换 IPC 处理器
 */
ipcMain.handle('oauth2-exchange-token', async (event, { provider, code, config }) => {
  try {
    const https = require('https');
    const http = require('http');
    const { SocksProxyAgent } = require('socks-proxy-agent');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    // 获取代理配置
    let agent = null;
    if (proxyConfig && proxyConfig.enabled) {
      const { protocol, host, port, auth } = proxyConfig;
      let proxyUrl;
      if (auth && auth.enabled && auth.username) {
        proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
      } else {
        proxyUrl = `${protocol}://${host}:${port}`;
      }
      
      if (protocol.startsWith('socks')) {
        agent = new SocksProxyAgent(proxyUrl);
      } else {
        agent = new HttpsProxyAgent(proxyUrl);
      }
      console.log('[OAuth2] Using proxy:', proxyUrl.replace(/:[^:@]+@/, ':***@'));
    }
    
    // 构建请求参数
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });
    
    const postData = params.toString();
    const url = new URL(config.tokenUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      agent: agent,
    };
    
    return new Promise((resolve, reject) => {
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve({
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                expiresIn: result.expires_in,
                expiresAt: Date.now() + result.expires_in * 1000,
              });
            } else {
              reject(new Error(result.error_description || result.error || 'Token exchange failed'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('[OAuth2] Token exchange failed:', error);
    throw error;
  }
});

/**
 * Gmail API 请求 IPC 处理器
 */
ipcMain.handle('gmail-api-request', async (event, url, options) => {
  try {
    const https = require('https');
    const http = require('http');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    // 如果启用了代理，创建 agent
    let agent = null;
    if (proxyConfig && proxyConfig.enabled) {
      const { protocol, host, port, auth } = proxyConfig;
      let proxyUrl;
      if (auth && auth.enabled && auth.username) {
        proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
      } else {
        proxyUrl = `${protocol}://${host}:${port}`;
      }
      agent = new HttpsProxyAgent(proxyUrl);
      console.log('[Gmail API] Using proxy:', proxyUrl.replace(/:[^:@]+@/, ':***@'));
    }
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        agent: agent,
      };
      
      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const result = data ? JSON.parse(data) : {};
              resolve(result);
            } else {
              const error = data ? JSON.parse(data) : {};
              reject(new Error(error.error?.message || `HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('[Gmail API] Request failed:', error);
        reject(error);
      });
      
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  } catch (error) {
    console.error('[Gmail API] Request error:', error);
    throw error;
  }
});

/**
 * OAuth2 Token 刷新 IPC 处理器
 */
ipcMain.handle('oauth2-refresh-token', async (event, { provider, refreshToken, config }) => {
  try {
    const https = require('https');
    const http = require('http');
    const { SocksProxyAgent } = require('socks-proxy-agent');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    // 获取代理配置
    let agent = null;
    if (proxyConfig && proxyConfig.enabled) {
      const { protocol, host, port, auth } = proxyConfig;
      let proxyUrl;
      if (auth && auth.enabled && auth.username) {
        proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
      } else {
        proxyUrl = `${protocol}://${host}:${port}`;
      }
      
      if (protocol.startsWith('socks')) {
        agent = new SocksProxyAgent(proxyUrl);
      } else {
        agent = new HttpsProxyAgent(proxyUrl);
      }
      console.log('[OAuth2] Using proxy for refresh:', proxyUrl.replace(/:[^:@]+@/, ':***@'));
    }
    
    // 构建请求参数
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    
    const postData = params.toString();
    const url = new URL(config.tokenUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      agent: agent,
    };
    
    return new Promise((resolve, reject) => {
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve({
                accessToken: result.access_token,
                expiresIn: result.expires_in,
                expiresAt: Date.now() + result.expires_in * 1000,
              });
            } else {
              reject(new Error(result.error_description || result.error || 'Token refresh failed'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('[OAuth2] Token refresh failed:', error);
    throw error;
  }
});

/**
 * 邮件导出 IPC 处理器
 */

// 导出邮件为CSV和ZIP
ipcMain.handle('export-mails', async (event, { mails, accounts }) => {
  try {
    console.log('[Export] Starting export for', mails.length, 'mails');

    // 显示保存对话框
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '选择导出目录',
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const outputDir = result.filePaths[0];

    // 定义获取附件的函数
    const getAttachment = async (accountId, mail, attachment) => {
      try {
        const account = accounts.find(acc => acc.id === accountId);
        if (!account) {
          console.error('[Export] Account not found:', accountId);
          return null;
        }

        if (account.protocol === 'gmail') {
          // Gmail API 获取附件
          if (!attachment.attachmentId || !mail.gmailId) {
            console.error('[Export] Missing Gmail attachment data');
            return null;
          }

          // 调用Gmail API获取附件
          const attachmentData = await getGmailAttachment(
            account.accessToken,
            mail.gmailId,
            attachment.attachmentId
          );

          if (attachmentData && attachmentData.data) {
            // Gmail API返回base64 URL编码的数据，需要转换
            const base64 = attachmentData.data.replace(/-/g, '+').replace(/_/g, '/');
            const padding = '='.repeat((4 - base64.length % 4) % 4);
            const paddedBase64 = base64 + padding;
            const content = Buffer.from(paddedBase64, 'base64');

            return {
              content,
              filename: attachment.filename,
              contentType: attachment.contentType || attachment.mimeType,
              size: attachment.size,
            };
          }
        } else if (account.protocol === 'imap') {
          // IMAP 获取附件
          if (!mail.uid) {
            console.error('[Export] Missing IMAP UID');
            return null;
          }

          // 先连接到IMAP服务器
          await imapService.connect({
            host: account.imapHost,
            port: account.imapPort,
            secure: account.imapSecure,
            auth: {
              user: account.email,
              pass: account.password,
            },
          });

          // 打开邮件所在的文件夹
          await imapService.openFolder(mail.folder || 'INBOX');

          // 获取该邮件的所有附件
          const attachments = await imapService.getMailAttachments(mail.uid);

          // 查找匹配的附件
          const matchedAttachment = attachments.find(att =>
            att.filename === attachment.filename && att.size === attachment.size
          );

          if (matchedAttachment) {
            return {
              content: matchedAttachment.content,
              filename: matchedAttachment.filename,
              contentType: matchedAttachment.contentType,
              size: matchedAttachment.size,
            };
          }
        }

        return null;
      } catch (error) {
        console.error('[Export] Failed to get attachment:', error);
        return null;
      }
    };

    // 定义进度回调函数
    const onProgress = (progress) => {
      // 发送进度事件到渲染进程
      event.sender.send('export-progress', progress);
    };

    // 执行导出
    const exportResult = await exportService.exportMails(mails, outputDir, {
      getAttachment,
      onProgress,
    });

    console.log('[Export] Export completed:', exportResult);

    return exportResult;
  } catch (error) {
    console.error('[Export] Export failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
});

// Gmail附件获取辅助函数
async function getGmailAttachment(accessToken, messageId, attachmentId) {
  const https = require('https');
  const { HttpsProxyAgent } = require('https-proxy-agent');

  let agent = null;
  if (proxyConfig && proxyConfig.enabled) {
    const { protocol, host, port, auth } = proxyConfig;
    let proxyUrl;
    if (auth && auth.enabled && auth.username) {
      proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
    } else {
      proxyUrl = `${protocol}://${host}:${port}`;
    }
    agent = new HttpsProxyAgent(proxyUrl);
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      agent: agent,
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const result = data ? JSON.parse(data) : {};
            resolve(result);
          } else {
            const error = data ? JSON.parse(data) : {};
            reject(new Error(error.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

