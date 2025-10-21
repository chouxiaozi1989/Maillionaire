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
        
        this.connection = new Imap(imapConfig);
        
        this.connection.once('ready', () => {
          console.log('[IMAP] Connection ready');
          resolve(true);
        });
        
        this.connection.once('error', (err) => {
          console.log('[IMAP] Connection error:', err);
          reject(err);
        });
        
        this.connection.once('end', () => {
          console.log('[IMAP] Connection ended');
        });
        
        // 关键修复：如果提供了自定义 socket，不要调用 connect()
        // 因为 socket 已经连接好了，再次 connect() 会导致 EISCONN 错误
        if (!imapConfig.socket) {
          // 没有提供 socket，使用直连，需要调用 connect()
          this.connection.connect();
        } else {
          // 提供了 socket，IMAP 库会自动使用这个 socket
          // 不需要调用 connect()，直接等待 'ready' 事件
          console.log('[IMAP] Socket provided, waiting for ready event...');
        }
      } catch (error) {
        console.error('[IMAP] Failed to initiate connection:', error);
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
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.openBox(folderName, false, (err, box) => {
        if (err) {
          reject(err);
        } else {
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
      
      this.connection.getBoxes((err, boxes) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 递归解析文件夹结构
        const parseFolders = (boxTree, parent = '') => {
          const folders = [];
          
          for (const [name, box] of Object.entries(boxTree)) {
            const fullPath = parent ? `${parent}${box.delimiter}${name}` : name;
            
            folders.push({
              name: name,
              path: fullPath,
              delimiter: box.delimiter,
              attributes: box.attribs || [],
              children: box.children ? Object.keys(box.children).length : 0,
            });
            
            // 递归处理子文件夹
            if (box.children) {
              folders.push(...parseFolders(box.children, fullPath));
            }
          }
          
          return folders;
        };
        
        const folders = parseFolders(boxes);
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
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.addFlags(uid, ['\\Seen'], (err) => {
        if (err) {
          reject(err);
        } else {
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
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.addFlags(uid, ['\\Deleted'], (err) => {
        if (err) {
          reject(err);
        } else {
          this.connection.expunge((err) => {
            if (err) {
              reject(err);
            } else {
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
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.move(uid, targetFolder, (err) => {
        if (err) {
          reject(err);
        } else {
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
        reject(new Error('IMAP not connected'));
        return;
      }
      
      this.connection.copy(uid, targetFolder, (err) => {
        if (err) {
          reject(err);
        } else {
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

      const mails = [];
      const fetch = this.connection.fetch(uids, {
        bodies: '',
        struct: true,
      });

      fetch.on('message', (msg, seqno) => {
        const mailData = {
          uid: null,
          flags: [],
          parsed: null,
        };

        msg.on('body', async (stream, info) => {
          try {
            const parsed = await simpleParser(stream);
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
          } catch (error) {
            console.error('Failed to parse mail:', error);
          }
        });

        msg.once('attributes', (attrs) => {
          mailData.uid = attrs.uid;
          mailData.flags = attrs.flags;
        });

        msg.once('end', () => {
          mails.push(mailData);
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
}

module.exports = new ImapMainService();
