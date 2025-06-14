const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * 使用macOS的原生截屏功能捕获屏幕区域
 * @returns {Promise<string>} 返回截图文件路径
 */
async function captureScreenMac() {
  try {
    console.log('开始使用macOS原生截屏功能');
    
    // 创建临时目录
    const tempDir = path.join(os.tmpdir(), 'quick-ocr');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // 生成临时文件路径
    const timestamp = new Date().getTime();
    const screenshotPath = path.join(tempDir, `screenshot-${timestamp}.png`);
    
    console.log('截图将保存到:', screenshotPath);
    
    return new Promise((resolve, reject) => {
      // 使用macOS的screencapture命令
      // -i: 交互式选择
      // -s: 选择模式
      // -o: 无窗口阴影
      const cmd = `screencapture -i -s -o "${screenshotPath}"`;
      
      console.log('执行命令:', cmd);
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('截屏命令执行失败:', error);
          reject(error);
          return;
        }
        
        // 检查文件是否创建成功
        if (fs.existsSync(screenshotPath) && fs.statSync(screenshotPath).size > 0) {
          console.log('截屏成功，文件大小:', fs.statSync(screenshotPath).size);
          resolve(screenshotPath);
        } else {
          // 如果文件不存在或为空，可能是用户取消了截屏
          console.log('用户可能取消了截屏');
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('截屏过程出错:', error);
    throw error;
  }
}

module.exports = {
  captureScreen: captureScreenMac
}; 