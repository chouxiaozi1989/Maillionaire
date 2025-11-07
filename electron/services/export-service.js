/**
 * 邮件导出服务
 * 支持导出邮件为CSV格式，并将附件打包为ZIP
 */

const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { createObjectCsvWriter } = require('csv-writer');

class ExportService {
  /**
   * 导出邮件为CSV和ZIP格式
   * @param {Array} mails - 邮件数组
   * @param {string} outputDir - 输出目录
   * @param {Object} options - 导出选项
   * @param {Function} options.getAttachment - 获取附件内容的函数 (accountId, mailId, attachment) => Buffer
   * @param {Function} options.onProgress - 进度回调函数 (progress) => void
   * @returns {Promise<Object>} 导出结果 {csvPath, zipPath}
   */
  async exportMails(mails, outputDir, options = {}) {
    try {
      const onProgress = options.onProgress || (() => {});
      const totalSteps = 2; // CSV导出 + 附件导出
      let currentStep = 0;

      // 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true });

      // 生成文件名（带时间戳）
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const csvPath = path.join(outputDir, `emails_export_${timestamp}.csv`);
      const zipPath = path.join(outputDir, `attachments_${timestamp}.zip`);

      // 步骤1: 导出CSV
      onProgress({
        step: 'csv',
        message: '正在导出CSV文件...',
        percent: 0,
      });

      await this.exportToCSV(mails, csvPath);
      console.log('[Export] CSV exported to:', csvPath);

      currentStep++;
      onProgress({
        step: 'csv',
        message: 'CSV文件导出完成',
        percent: Math.round((currentStep / totalSteps) * 100),
      });

      // 步骤2: 导出附件
      const hasAttachments = mails.some(mail => mail.hasAttachment && mail.attachments?.length > 0);
      let zipCreated = false;

      if (hasAttachments && options.getAttachment) {
        onProgress({
          step: 'attachments',
          message: '正在打包附件...',
          percent: Math.round((currentStep / totalSteps) * 100),
        });

        zipCreated = await this.exportAttachments(mails, zipPath, options.getAttachment, (progress) => {
          // 附件导出进度占总进度的50%
          const attachmentPercent = Math.round((currentStep / totalSteps) * 100 + (progress.percent / totalSteps));
          onProgress({
            step: 'attachments',
            message: progress.message,
            percent: attachmentPercent,
            current: progress.current,
            total: progress.total,
          });
        });

        if (zipCreated) {
          console.log('[Export] Attachments exported to:', zipPath);
        }
      }

      currentStep++;
      onProgress({
        step: 'complete',
        message: '导出完成',
        percent: 100,
      });

      return {
        csvPath,
        zipPath: zipCreated ? zipPath : null,
        mailCount: mails.length,
        success: true,
      };
    } catch (error) {
      console.error('[Export] Export failed:', error);
      throw error;
    }
  }

  /**
   * 导出邮件为CSV
   * @param {Array} mails - 邮件数组
   * @param {string} csvPath - CSV文件路径
   */
  async exportToCSV(mails, csvPath) {
    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'accountId', title: '账户ID' },
        { id: 'folder', title: '文件夹' },
        { id: 'from', title: '发件人' },
        { id: 'to', title: '收件人' },
        { id: 'cc', title: '抄送' },
        { id: 'subject', title: '主题' },
        { id: 'date', title: '日期' },
        { id: 'preview', title: '预览' },
        { id: 'hasAttachment', title: '有附件' },
        { id: 'attachmentCount', title: '附件数量' },
        { id: 'attachmentNames', title: '附件名称' },
        { id: 'read', title: '已读' },
        { id: 'flagged', title: '星标' },
        { id: 'body', title: '正文' },
      ],
      encoding: 'utf8',
      // 添加 BOM 以支持 Excel 正确识别 UTF-8
      append: false,
    });

    // 转换邮件数据为CSV格式
    const records = mails.map(mail => ({
      id: mail.id || '',
      accountId: mail.accountId || '',
      folder: mail.folder || '',
      from: mail.from || '',
      to: mail.to || '',
      cc: mail.cc || '',
      subject: mail.subject || '',
      date: mail.date ? new Date(mail.date).toLocaleString('zh-CN') : '',
      preview: mail.preview || '',
      hasAttachment: mail.hasAttachment ? '是' : '否',
      attachmentCount: mail.attachments?.length || 0,
      attachmentNames: mail.attachments?.map(a => a.filename).join('; ') || '',
      read: mail.read ? '是' : '否',
      flagged: mail.flagged ? '是' : '否',
      body: this.stripHtml(mail.body || ''),
    }));

    // 写入 BOM
    await fs.writeFile(csvPath, '\ufeff', 'utf8');

    // 写入CSV数据
    await csvWriter.writeRecords(records);
  }

  /**
   * 导出附件为ZIP
   * @param {Array} mails - 邮件数组
   * @param {string} zipPath - ZIP文件路径
   * @param {Function} getAttachment - 获取附件内容的函数
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<boolean>} 是否成功创建ZIP
   */
  async exportAttachments(mails, zipPath, getAttachment, onProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        const onProgressCallback = onProgress || (() => {});

        // 计算总附件数
        let totalAttachments = 0;
        mails.forEach(mail => {
          if (mail.hasAttachment && mail.attachments) {
            totalAttachments += mail.attachments.length;
          }
        });

        let processedAttachments = 0;

        // 创建写入流
        const output = require('fs').createWriteStream(zipPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // 最高压缩级别
        });

        let hasFiles = false;

        // 监听错误
        archive.on('error', (err) => {
          reject(err);
        });

        // 监听完成
        output.on('close', () => {
          console.log(`[Export] ZIP created: ${archive.pointer()} bytes`);
          resolve(hasFiles);
        });

        // 管道输出
        archive.pipe(output);

        // 遍历邮件，添加附件
        for (const mail of mails) {
          if (!mail.hasAttachment || !mail.attachments || mail.attachments.length === 0) {
            continue;
          }

          // 为每封邮件创建文件夹
          const mailFolder = this.sanitizeFileName(`${mail.id}_${mail.subject || 'no-subject'}`).slice(0, 100);

          // 遍历附件
          for (const attachment of mail.attachments) {
            try {
              // 更新进度
              onProgressCallback({
                percent: Math.round((processedAttachments / totalAttachments) * 100),
                current: processedAttachments,
                total: totalAttachments,
                message: `正在处理附件 ${processedAttachments + 1}/${totalAttachments}: ${attachment.filename}`,
              });

              // 获取附件内容
              const attachmentData = await getAttachment(mail.accountId, mail, attachment);

              if (attachmentData && attachmentData.content) {
                // 清理文件名
                const safeFilename = this.sanitizeFileName(attachment.filename || 'unnamed');
                const filePath = `${mailFolder}/${safeFilename}`;

                // 添加到ZIP
                archive.append(attachmentData.content, { name: filePath });
                hasFiles = true;

                console.log(`[Export] Added attachment: ${filePath}`);
              }

              processedAttachments++;
            } catch (error) {
              console.error(`[Export] Failed to get attachment ${attachment.filename}:`, error.message);
              processedAttachments++;
              // 继续处理其他附件
            }
          }
        }

        // 最终进度更新
        onProgressCallback({
          percent: 100,
          current: totalAttachments,
          total: totalAttachments,
          message: '附件打包完成',
        });

        // 完成归档
        await archive.finalize();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 清理HTML标签
   * @param {string} html - HTML字符串
   * @returns {string} 纯文本
   */
  stripHtml(html) {
    if (!html) return '';
    // 移除HTML标签
    let text = html.replace(/<[^>]*>/g, '');
    // 解码HTML实体
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    // 移除多余空白
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  /**
   * 清理文件名，移除非法字符
   * @param {string} filename - 文件名
   * @returns {string} 清理后的文件名
   */
  sanitizeFileName(filename) {
    if (!filename) return 'unnamed';
    // 移除或替换非法字符
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .trim();
  }
}

module.exports = new ExportService();
