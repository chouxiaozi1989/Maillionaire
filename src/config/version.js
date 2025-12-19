/**
 * 应用版本信息配置
 * 统一管理应用版本号
 */

export const APP_VERSION = {
  version: '1.2.1',
  buildDate: '2025-12-19',
  name: 'Maillionaire',
  description: '专业的跨平台邮件收发客户端',
  copyright: '© 2025 Maillionaire Team',
  license: 'MIT',
  
  // 完整版本字符串
  get fullVersion() {
    return `v${this.version}`
  },
  
  // 版本信息字符串（用于界面显示）
  get versionString() {
    return `Version ${this.version}`
  },
  
  // 完整版本信息（包括日期）
  get fullVersionString() {
    return `Version ${this.version} (${this.buildDate})`
  },
  
  // 关于信息
  get aboutInfo() {
    return `${this.name} ${this.fullVersion} - ${this.description}`
  }
}

// 导出版本号供其他模块使用
export const VERSION = APP_VERSION.version
export const VERSION_FULL = APP_VERSION.fullVersion
export const BUILD_DATE = APP_VERSION.buildDate

export default APP_VERSION
