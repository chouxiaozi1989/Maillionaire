/**
 * SMTP邮件发送服务（主进程版本）
 * 在 Electron 主进程中使用 nodemailer
 */

const nodemailer = require('nodemailer');

class SmtpMainService {
  constructor() {
    this.transporter = null;
    this.proxyConfig = null;
  }
  
  /**
   * 设置代理配置
   */
  setProxyConfig(config) {
    this.proxyConfig = config;
    console.log('[SMTP] Proxy config updated:', config?.enabled ? 'enabled' : 'disabled');
  }
  
  /**
   * 获取代理 agent
   */
  getProxyAgent() {
    if (!this.proxyConfig || !this.proxyConfig.enabled) {
      return null;
    }
    
    try {
      const { protocol, host, port, auth } = this.proxyConfig;
      
      // 构建代理 URL
      let proxyUrl;
      if (auth && auth.enabled && auth.username) {
        proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
      } else {
        proxyUrl = `${protocol}://${host}:${port}`;
      }
      
      // 根据协议选择 agent
      if (protocol.startsWith('socks')) {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        return new SocksProxyAgent(proxyUrl);
      } else {
        const { HttpsProxyAgent } = require('https-proxy-agent');
        return new HttpsProxyAgent(proxyUrl);
      }
    } catch (error) {
      console.error('[SMTP] Failed to create proxy agent:', error);
      return null;
    }
  }
  
  /**
   * 创建SMTP传输器
   */
  createTransporter(config) {
    const transportConfig = {
      host: config.smtpHost,
      port: config.smtpPort || 465,
      secure: config.secure !== false, // true for 465, false for other ports
      auth: {
        user: config.email,
        pass: config.password || config.accessToken,
      },
    };
    
    // 添加代理支持
    const proxyAgent = this.getProxyAgent();
    if (proxyAgent) {
      transportConfig.proxy = proxyAgent;
      console.log('[SMTP] Using proxy for connection');
    }
    
    this.transporter = nodemailer.createTransport(transportConfig);
  }
  
  /**
   * 验证SMTP配置
   */
  async verify(config) {
    try {
      this.createTransporter(config);
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP verification failed:', error);
      throw error;
    }
  }
  
  /**
   * 发送邮件
   */
  async sendMail(config, mailOptions) {
    try {
      this.createTransporter(config);
      
      const info = await this.transporter.sendMail({
        from: mailOptions.from,
        to: mailOptions.to,
        cc: mailOptions.cc,
        bcc: mailOptions.bcc,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
        attachments: mailOptions.attachments,
      });
      
      console.log('Mail sent:', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      console.error('Failed to send mail:', error);
      throw error;
    }
  }
}

module.exports = new SmtpMainService();
