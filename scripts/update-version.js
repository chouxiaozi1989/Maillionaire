/**
 * 版本号自动更新脚本
 * 
 * 使用方法：
 * node scripts/update-version.js 1.2.0
 * 
 * 功能：
 * 1. 更新 package.json 中的 version
 * 2. 更新 src/config/version.js 中的 version 和 buildDate
 * 3. 提示需要手动更新的其他文件
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('❌ 错误：请提供新的版本号');
  console.log('使用方法: node scripts/update-version.js 1.2.0');
  process.exit(1);
}

// 验证版本号格式（语义化版本）
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(newVersion)) {
  console.error('❌ 错误：版本号格式不正确');
  console.log('请使用语义化版本格式: MAJOR.MINOR.PATCH (如: 1.2.0)');
  process.exit(1);
}

const buildDate = new Date().toISOString().split('T')[0];

console.log('🚀 开始更新版本号...\n');
console.log(`📦 新版本: ${newVersion}`);
console.log(`📅 构建日期: ${buildDate}\n`);

// 1. 更新 package.json
try {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const oldVersion = pkg.version;
  
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  
  console.log(`✅ 已更新 package.json`);
  console.log(`   ${oldVersion} -> ${newVersion}\n`);
} catch (error) {
  console.error(`❌ 更新 package.json 失败:`, error.message);
  process.exit(1);
}

// 2. 更新 src/config/version.js
try {
  const versionPath = path.join(__dirname, '../src/config/version.js');
  let content = fs.readFileSync(versionPath, 'utf-8');
  
  // 更新 version
  content = content.replace(
    /version: '[^']+'/,
    `version: '${newVersion}'`
  );
  
  // 更新 buildDate
  content = content.replace(
    /buildDate: '[^']+'/,
    `buildDate: '${buildDate}'`
  );
  
  fs.writeFileSync(versionPath, content);
  
  console.log(`✅ 已更新 src/config/version.js`);
  console.log(`   版本: ${newVersion}`);
  console.log(`   日期: ${buildDate}\n`);
} catch (error) {
  console.error(`❌ 更新 src/config/version.js 失败:`, error.message);
  process.exit(1);
}

// 3. 提示需要手动更新的文件
console.log('📝 请手动更新以下文件：\n');
console.log('1. docs/07-版本记录/CHANGELOG.md');
console.log('   - 添加新版本的更新记录\n');

console.log('2. README.md');
console.log('   - 更新版本标识\n');

console.log('3. Git 标签');
console.log('   - 提交代码: git add .');
console.log('   - 提交信息: git commit -m "chore: bump version to ' + newVersion + '"');
console.log('   - 创建标签: git tag v' + newVersion);
console.log('   - 推送代码: git push origin main --tags\n');

console.log('✨ 版本号更新完成！\n');

// 显示版本对比
console.log('📊 版本信息汇总：');
console.log(`┌─────────────────────────────────────┐`);
console.log(`│ 版本号: v${newVersion.padEnd(26)} │`);
console.log(`│ 日期:   ${buildDate.padEnd(26)} │`);
console.log(`└─────────────────────────────────────┘`);
