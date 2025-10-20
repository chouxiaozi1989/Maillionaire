/**
 * SMTP邮件发送服务（主进程版本）
 * 在 Electron 主进程中使用 nodemailer
 */

const nodemailer = require('nodemailer');

class SmtpMainService {
  constructor() {
    this.transporter = null;
  }
  
  /**
   * 创建SMTP传输器
   */
  createTransporter(config) {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 465,
      secure: config.secure !== false, // true for 465, false for other ports
      auth: {
        user: config.email,
        pass: config.password || config.accessToken,
      },
    });
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
