// 这个脚本会在打包过程中自动复制preload脚本到多个可能的位置
const fs = require('fs');
const path = require('path');

console.log('准备预加载脚本...');

// 源文件路径
const preloadSrc = path.join(__dirname, 'preload.js');
const preloadBundleSrc = path.join(__dirname, 'preload-bundle.js');

// 确保预加载脚本存在
if (!fs.existsSync(preloadSrc)) {
  console.error('预加载脚本不存在:', preloadSrc);
  process.exit(1);
}

// 确保bundle版本的预加载脚本存在
if (!fs.existsSync(preloadBundleSrc)) {
  console.log('创建预加载脚本的bundle版本');
  
  // 读取原始预加载脚本
  const preloadContent = fs.readFileSync(preloadSrc, 'utf8');
  
  // 创建简化版本
  fs.writeFileSync(preloadBundleSrc, preloadContent, 'utf8');
  console.log('已创建bundle版本的预加载脚本');
} else {
  console.log('预加载脚本的bundle版本已存在');
}

console.log('预加载脚本准备完成'); 