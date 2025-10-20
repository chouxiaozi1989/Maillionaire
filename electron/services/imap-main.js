/**
 * IMAP邮件服务（主进程版本）
 * 在 Electron 主进程中使用 imap 库
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');

class ImapMainService {
  constructor() {
    this.connection = null;
  }
  
  /**
   * 连接到IMAP服务器
   */
  async connect(config) {
    return new Promise((resolve, reject) => {
      this.connection = new Imap({
        user: config.email,
        password: config.password || config.accessToken,
        host: config.imapHost,
        port: config.imapPort || 993,
        tls: config.tls !== false,
        tlsOptions: { rejectUnauthorized: false },
      });
      
      this.connection.once('ready', () => {
        console.log('IMAP connection ready');
        resolve(true);
      });
      
      this.connection.once('error', (err) => {
        console.error('IMAP connection error:', err);
        reject(err);
      });
      
      this.connection.connect();
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
