/**
 * IMAP邮件服务（主进程版本）
 * 在 Electron 主进程中使用 imap 库
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');

class ImapMainService {
  constructor() {
    this.connection = null;
    this.proxyConfig = null;
  }
  
  /**
   * 设置代理配置
   */
  setProxyConfig(config) {
    this.proxyConfig = config;
    console.log('[IMAP] Proxy config updated:', config?.enabled ? 'enabled' : 'disabled');
  }
  
  /**
   * 获取代理 socket
   */
  getProxySocket(host, port) {
    if (!this.proxyConfig || !this.proxyConfig.enabled) {
      console.log('[IMAP] Proxy not enabled, using direct connection');
      return null;
    }
    
    try {
      const { protocol, host: proxyHost, port: proxyPort, auth } = this.proxyConfig;
      
      console.log(`[IMAP] Creating proxy socket: ${protocol}://${proxyHost}:${proxyPort}`);
      
      if (protocol.startsWith('socks')) {
        const { SocksClient } = require('socks');
        
        const socksOptions = {
          proxy: {
            host: proxyHost,
            port: proxyPort,
            type: protocol === 'socks5' ? 5 : 4,
          },
          command: 'connect',
          destination: {
            host: host,
            port: port,
          },
          timeout: 30000, // 30 秒超时
        };
        
        // 添加认证信息
        if (auth && auth.enabled && auth.username) {
          socksOptions.proxy.userId = auth.username;
          socksOptions.proxy.password = auth.password;
          console.log('[IMAP] Using proxy authentication');
        }
        
        // 返回一个 Promise，在 connect 时解析
        return async () => {
          console.log(`[IMAP] Connecting to ${host}:${port} via SOCKS proxy...`);
          const info = await SocksClient.createConnection(socksOptions);
          console.log('[IMAP] SOCKS proxy socket created successfully');
          return info.socket;
        };
      } else if (protocol === 'http' || protocol === 'https') {
        // HTTP/HTTPS 代理：使用 CONNECT 方法
        console.log(`[IMAP] Using HTTP/HTTPS proxy with CONNECT method`);
        
        return async () => {
          const net = require('net');
          const tls = require('tls');
          
          return new Promise((resolve, reject) => {
            console.log(`[IMAP] Connecting to proxy ${proxyHost}:${proxyPort}...`);
            
            // 连接到代理服务器
            const proxySocket = net.connect({
              host: proxyHost,
              port: proxyPort,
              timeout: 30000,
            });
            
            proxySocket.on('connect', () => {
              console.log(`[IMAP] Connected to proxy, sending CONNECT request...`);
              
              // 发送 HTTP CONNECT 请求
              let connectRequest = `CONNECT ${host}:${port} HTTP/1.1\r\n`;
              connectRequest += `Host: ${host}:${port}\r\n`;
              
              // 如果有认证
              if (auth && auth.enabled && auth.username) {
                const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
                connectRequest += `Proxy-Authorization: Basic ${credentials}\r\n`;
                console.log('[IMAP] Using proxy authentication');
              }
              
              connectRequest += '\r\n';
              
              proxySocket.write(connectRequest);
            });
            
            // 监听代理响应
            let responseData = '';
            const onData = (data) => {
              responseData += data.toString();
              
              // 检查是否收到完整的 HTTP 响应
              if (responseData.includes('\r\n\r\n')) {
                proxySocket.removeListener('data', onData);
                
                // 解析响应
                const statusLine = responseData.split('\r\n')[0];
                const statusCode = parseInt(statusLine.split(' ')[1]);
                
                if (statusCode === 200) {
                  console.log('[IMAP] HTTP CONNECT successful, tunnel established');
                  resolve(proxySocket);
                } else {
                  console.error(`[IMAP] HTTP CONNECT failed with status ${statusCode}`);
                  proxySocket.destroy();
                  reject(new Error(`Proxy CONNECT failed: ${statusCode}`));
                }
              }
            };
            
            proxySocket.on('data', onData);
            
            proxySocket.on('error', (err) => {
              console.error('[IMAP] Proxy socket error:', err);
              reject(err);
            });
            
            proxySocket.on('timeout', () => {
              console.error('[IMAP] Proxy connection timeout');
              proxySocket.destroy();
              reject(new Error('Proxy connection timeout'));
            });
          });
        };
      } else {
        console.warn(`[IMAP] Unsupported proxy protocol: ${protocol}`);
        return null;
      }
    } catch (error) {
      console.error('[IMAP] Failed to create proxy socket:', error);
      return null;
    }
  }
  
  /**
   * 连接到IMAP服务器
   */
  async connect(config) {
    return new Promise(async (resolve, reject) => {
      try {
        // 如果已经有连接，先断开
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
          connTimeout: 30000, // 30 秒连接超时
          authTimeout: 30000, // 30 秒认证超时
        };
        
        console.log(`[IMAP] Connecting to ${config.imapHost}:${config.imapPort || 993}`);
        
        // 添加代理支持
        const proxySocketFactory = this.getProxySocket(config.imapHost, config.imapPort || 993);
        if (proxySocketFactory) {
          try {
            const socket = await proxySocketFactory();
            
            // 检查 socket 状态
            // 注意：SOCKS 代理返回的 socket 可能处于 connecting 状态
            // 而 HTTP 代理返回的 socket 已经完全连接（CONNECT 成功后）
            const isConnected = socket.readyState === 'open' || socket.writable;
            const isConnecting = socket.connecting || socket.readyState === 'opening';
            
            if (isConnecting && !isConnected) {
              console.log('[IMAP] Waiting for proxy socket to connect...');
              await new Promise((resolve, reject) => {
                socket.once('connect', () => {
                  console.log('[IMAP] Proxy socket connected');
                  resolve();
                });
                socket.once('error', (err) => {
                  console.error('[IMAP] Proxy socket error:', err);
                  reject(err);
                });
              });
            } else if (isConnected) {
              console.log('[IMAP] Proxy socket already connected (HTTP CONNECT)');
            } else {
              console.log('[IMAP] Proxy socket state:', {
                readyState: socket.readyState,
                connecting: socket.connecting,
                writable: socket.writable
              });
            }
            
            imapConfig.socket = socket;
            console.log('[IMAP] Using proxy socket for connection');
          } catch (error) {
            console.error('[IMAP] Proxy connection failed:', error);
            reject(new Error(`Proxy connection failed: ${error.message}`));
            return;
          }
        } else {
          console.log('[IMAP] Using direct connection (no proxy)');
        }
        
        // 创建连接对象（暂不赋值给 this.connection）
        const connection = new Imap(imapConfig);
        
        connection.once('ready', () => {
          console.log('[IMAP] Connection ready');
          // ✅ 在 ready 事件中才设置 this.connection
          this.connection = connection;
          resolve(true);
        });
        
        connection.once('error', (err) => {
          console.error('[IMAP] Connection error:', err);
          this.connection = null;
          reject(err);
        });
        
        connection.once('end', () => {
          console.log('[IMAP] Connection ended');
          if (this.connection === connection) {
            this.connection = null;
          }
        });
        
        // 关键修复：如果提供了自定义 socket，不要调用 connect()
        // 因为 socket 已经连接好了，再次 connect() 会导致 EISCONN 错误
        if (!imapConfig.socket) {
          // 没有提供 socket，使用直连，需要调用 connect()
          connection.connect();
        } else {
          // 提供了 socket，IMAP 库会自动使用这个 socket
          // 不需要调用 connect()，直接等待 'ready' 事件
          console.log('[IMAP] Socket provided, waiting for ready event...');
        }
      } catch (error) {
        console.error('[IMAP] Failed to initiate connection:', error);
        this.connection = null;
        reject(error);
      }
    });
  }
  
  /**
   * 断开连接
   */
  disconnect() {
    if (this.connection) {
      this.connection.end();
      this.connection = null;
    }
  }
  
  /**
   * 获取文件夹列表
   */
  async getFolders() {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.getBoxes((err, boxes) => {
        if (err) {
          reject(err);
        } else {
          resolve(boxes);
        }
      });
    });
  }
  
  /**
   * 打开文件夹
   */
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
  
  /**
   * 搜索邮件
   */
  async searchMails(criteria) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.search(criteria, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  }
  
  /**
   * 获取服务器文件夹列表（扁平化）
   */
  async getServerFolders() {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }
      
      console.log('[IMAP] Fetching server folders...');
      
      this.connection.getBoxes((err, boxes) => {
        if (err) {
          console.error('[IMAP] Failed to get boxes:', err);
          reject(err);
          return;
        }
        
        // ✅ 输出文件夹名称列表而不是完整对象（避免循环引用）
        console.log('[IMAP] Server folders:', Object.keys(boxes).join(', '));
        
        // 递归解析文件夹结构
        const parseFolders = (boxTree, parent = '') => {
          const folders = [];
          
          for (const [name, box] of Object.entries(boxTree)) {
            const fullPath = parent ? `${parent}${box.delimiter}${name}` : name;
            
            const folder = {
              name: name,
              path: fullPath,
              delimiter: box.delimiter,
              attributes: box.attribs || [],
              children: box.children ? Object.keys(box.children).length : 0,
            };
            
            console.log('[IMAP] Parsed folder:', folder);
            folders.push(folder);
            
            // 递归处理子文件夹
            if (box.children) {
              folders.push(...parseFolders(box.children, fullPath));
            }
          }
          
          return folders;
        };
        
        const folders = parseFolders(boxes);
        console.log(`[IMAP] Total ${folders.length} folders found`);
        resolve(folders);
      });
    });
  }
  
  /**
   * 创建文件夹
   */
  async createFolder(folderName) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.addBox(folderName, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  /**
   * 删除文件夹
   */
  async deleteFolder(folderName) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.delBox(folderName, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  /**
   * 重命名文件夹
   */
  async renameFolder(oldName, newName) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.renameBox(oldName, newName, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  /**
   * 标记邮件为已读
   */
  async markAsRead(uid) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        console.error('[IMAP] markAsRead: Connection is null');
        reject(new Error('IMAP not connected'));
        return;
      }
      
      // 检查连接状态
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
  
  /**
   * 删除邮件
   */
  async deleteMail(uid) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        console.error('[IMAP] deleteMail: Connection is null');
        reject(new Error('IMAP not connected'));
        return;
      }
      
      // 检查连接状态
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
  
  /**
   * 移动邮件到文件夹
   */
  async moveMail(uid, targetFolder) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        console.error('[IMAP] moveMail: Connection is null');
        reject(new Error('IMAP not connected'));
        return;
      }
      
      // 检查连接状态
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
  
  /**
   * 复制邮件到文件夹
   */
  async copyMail(uid, targetFolder) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        console.error('[IMAP] copyMail: Connection is null');
        reject(new Error('IMAP not connected'));
        return;
      }
      
      // 检查连接状态
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

  /**
   * 获取邮件内容
   * @param {Array} uids - 邮件UID数组
   * @param {Object} options - 选项 { bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)', struct: true }
   * @returns {Promise<Array>} 邮件列表
   */
  async fetchMails(uids, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }

      if (!uids || uids.length === 0) {
        resolve([]);
        return;
      }

      const mails = [];
      const fetch = this.connection.fetch(uids, {
        bodies: options.bodies || '',
        struct: options.struct !== false,
      });

      fetch.on('message', (msg, seqno) => {
        const mail = {
          uid: null,
          flags: [],
          date: null,
          headers: {},
          body: '',
          struct: null,
        };

        msg.on('body', (stream, info) => {
          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          stream.once('end', () => {
            if (info.which === '') {
              // 完整邮件体
              mail.body = buffer;
            } else {
              // 头部信息
              const lines = buffer.split('\r\n');
              lines.forEach(line => {
                const match = line.match(/^([^:]+):\s*(.+)$/);
                if (match) {
                  const key = match[1].toLowerCase();
                  mail.headers[key] = match[2];
                }
              });
            }
          });
        });

        msg.once('attributes', (attrs) => {
          mail.uid = attrs.uid;
          mail.flags = attrs.flags;
          mail.date = attrs.date;
          mail.struct = attrs.struct;
        });

        msg.once('end', () => {
          mails.push(mail);
        });
      });

      fetch.once('error', (err) => {
        reject(err);
      });

      fetch.once('end', () => {
        resolve(mails);
      });
    });
  }

  /**
   * 使用 mailparser 解析邮件内容
   * @param {Array} uids - 邮件UID数组
   * @returns {Promise<Array>} 解析后的邮件列表
   */
  async fetchAndParseMails(uids) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('IMAP not connected'));
        return;
      }

      if (!uids || uids.length === 0) {
        resolve([]);
        return;
      }

      console.log(`[IMAP] Fetching and parsing ${uids.length} mails...`);
      
      const mails = [];
      const fetch = this.connection.fetch(uids, {
        bodies: '',
        struct: true,
      });
      
      // 设置超时（60秒）
      const timeout = setTimeout(() => {
        console.error('[IMAP] Fetch timeout after 60s');
        fetch.removeAllListeners();
        reject(new Error('Mail fetch timeout after 60 seconds'));
      }, 60000);
      
      let processedCount = 0;

      fetch.on('message', (msg, seqno) => {
        const mailData = {
          uid: null,
          flags: [],
          parsed: null,
        };

        let bodyParsed = false;
        let attributesReceived = false;

        // 检查是否两个事件都完成
        const checkComplete = () => {
          if (bodyParsed && attributesReceived) {
            processedCount++;
            mails.push(mailData);
            console.log(`[IMAP] Processed ${processedCount}/${uids.length} mails - UID: ${mailData.uid}, Subject: ${mailData.parsed?.subject || '(无主题)'}, Has content: ${!!(mailData.parsed?.html || mailData.parsed?.text)}`);
          }
        };

        msg.on('body', async (stream, info) => {
          try {
            console.log(`[IMAP] Parsing mail body for seqno: ${seqno}`);
            const parsed = await simpleParser(stream);

            // 记录解析结果
            console.log(`[IMAP] Parsed mail - Subject: ${parsed.subject}, Has HTML: ${!!parsed.html}, Has Text: ${!!parsed.text}`);

            mailData.parsed = {
              from: parsed.from?.text || '',
              to: parsed.to?.text || '',
              cc: parsed.cc?.text || '',
              subject: parsed.subject || '',
              date: parsed.date,
              text: parsed.text || '',
              html: parsed.html || '',
              textAsHtml: parsed.textAsHtml || '',
              attachments: parsed.attachments?.map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
              })) || [],
            };

            bodyParsed = true;
            checkComplete();
          } catch (error) {
            console.error('[IMAP] Failed to parse mail:', error);
            // 解析失败也要继续处理，不影响其他邮件
            mailData.parsed = {
              from: '',
              to: '',
              subject: '(解析失败)',
              date: new Date(),
              text: error.message,
              html: '',
              textAsHtml: '',
              attachments: [],
            };
            bodyParsed = true;
            checkComplete();
          }
        });

        msg.once('attributes', (attrs) => {
          mailData.uid = attrs.uid;
          mailData.flags = attrs.flags;
          attributesReceived = true;
          checkComplete();
        });
      });

      fetch.once('error', (err) => {
        clearTimeout(timeout);
        console.error('[IMAP] Fetch error:', err);
        reject(err);
      });

      fetch.once('end', () => {
        clearTimeout(timeout);
        console.log(`[IMAP] Fetch completed, total ${mails.length} mails`);
        resolve(mails);
      });
    });
  }

  /**
   * 获取邮件附件内容
   * @param {number} uid - 邮件UID
   * @returns {Promise<Array>} 附件数组，每个附件包含 {filename, contentType, size, content: Buffer}
   */
  async getMailAttachments(uid) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        return reject(new Error('IMAP not connected'));
      }

      console.log(`[IMAP] Fetching attachments for mail UID: ${uid}`);

      const fetch = this.connection.fetch(uid, {
        bodies: '',
        struct: true,
      });

      const attachments = [];

      fetch.on('message', (msg) => {
        msg.on('body', async (stream) => {
          try {
            const parsed = await simpleParser(stream);

            // 提取包含content的完整附件
            if (parsed.attachments && parsed.attachments.length > 0) {
              parsed.attachments.forEach(att => {
                attachments.push({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  content: att.content, // Buffer
                });
              });
            }
          } catch (error) {
            console.error('[IMAP] Failed to parse mail for attachments:', error);
          }
        });
      });

      fetch.once('error', (err) => {
        console.error('[IMAP] Fetch attachments error:', err);
        reject(err);
      });

      fetch.once('end', () => {
        console.log(`[IMAP] Fetched ${attachments.length} attachments for UID: ${uid}`);
        resolve(attachments);
      });
    });
  }
}

module.exports = new ImapMainService();
