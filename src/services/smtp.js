/**
 * SMTP邮件发送服务（渲染进程版本）
 * 通过 IPC 调用主进程的 nodemailer
 */

class SmtpService {
  /**
   * 检查是否在 Electron 环境
   */
  get isElectron() {
    return !!window.electronAPI
  }
  
  /**
   * 验证SMTP配置
   */
  async verify(config) {
    try {
      if (this.isElectron) {
        // Electron 环境：通过 IPC 调用主进程
        return await window.electronAPI.verifySmtp(config)
      } else {
        // 浏览器环境：返回模拟结果
        console.warn('[SMTP] Browser mode: verification skipped')
        return true
      }
    } catch (error) {
      console.error('SMTP verification failed:', error)
      throw error
    }
  }
  
  /**
   * 发送邮件
   */
  async sendMail(config, mailOptions) {
    try {
      if (this.isElectron) {
        // Electron 环境：通过 IPC 调用主进程
        const info = await window.electronAPI.sendEmail({
          config,
          mailOptions: {
            from: mailOptions.from,
            to: mailOptions.to,
            cc: mailOptions.cc,
            bcc: mailOptions.bcc,
            subject: mailOptions.subject,
            text: mailOptions.text,
            html: mailOptions.html,
            attachments: mailOptions.attachments,
          }
        })
        console.log('Mail sent:', info.messageId)
        return info
      } else {
        // 浏览器环境：返回模拟结果
        console.warn('[SMTP] Browser mode: email not actually sent')
        console.log('[SMTP] Would send:', mailOptions)
        return {
          success: true,
          messageId: 'mock_' + Date.now(),
          response: 'Mock response (browser mode)'
        }
      }
    } catch (error) {
      console.error('Failed to send mail:', error)
      throw error
    }
  }
  
  /**
   * 发送HTML邮件
   */
  async sendHtmlMail(config, mailData) {
    return await this.sendMail(config, {
      from: `"${mailData.fromName || config.email}" <${config.email}>`,
      to: mailData.to,
      cc: mailData.cc,
      bcc: mailData.bcc,
      subject: mailData.subject,
      html: mailData.html,
      attachments: mailData.attachments,
    })
  }
}

export const smtpService = new SmtpService()
