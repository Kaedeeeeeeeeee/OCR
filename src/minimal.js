const { app, BrowserWindow, Tray, Menu, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('启动最小化Electron应用');

// 全局变量
let tray = null;
let mainWindow = null;

// 记录应用目录
console.log('应用路径:', __dirname);
console.log('userData路径:', app.getPath('userData'));

// 在MacOS上隐藏Dock图标
if (process.platform === 'darwin') {
  app.dock.hide();
}

// 简单的内嵌图标 - 16x16 黑色字母 "O"
const iconData = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <circle cx="8" cy="8" r="7" stroke="black" stroke-width="2" fill="none" />
</svg>
`;

// 当应用准备好时
app.whenReady().then(() => {
  console.log('应用已准备就绪');
  
  // 创建一个简单的窗口
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: true
  });
  
  // 创建一个简单的HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>诊断窗口</title>
    </head>
    <body>
      <h1>最小化Electron应用</h1>
      <p>如果您能看到此窗口，则说明Electron核心功能正常工作。</p>
    </body>
    </html>
  `;
  
  // 创建临时HTML文件
  const tempHtml = path.join(app.getPath('temp'), 'quick-ocr-test.html');
  fs.writeFileSync(tempHtml, htmlContent);
  
  console.log('加载测试页面:', tempHtml);
  mainWindow.loadFile(tempHtml);
  
  // 显示在Dock中
  if (process.platform === 'darwin') {
    app.dock.show();
  }
  
  // 创建托盘图标
  createTray();
  
  // 显示对话框
  setTimeout(() => {
    dialog.showMessageBox({
      type: 'info',
      title: '诊断',
      message: '应用已成功启动',
      detail: '基本功能测试成功。',
      buttons: ['确定']
    });
  }, 1000);
  
  console.log('应用初始化完成');
}).catch(err => {
  console.error('应用启动失败:', err);
  dialog.showErrorBox('错误', `启动失败: ${err.message}`);
});

// 创建托盘图标
function createTray() {
  try {
    console.log('创建托盘图标...');
    
    // 使用内嵌的SVG创建图标
    let icon = nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(iconData).toString('base64'));
    
    if (process.platform === 'darwin') {
      // 对于macOS，必须设置为模板图像以在状态栏中正确显示
      icon.setTemplateImage(true);
      console.log('已创建MacOS模板图标');
    }
    
    // 创建托盘图标
    tray = new Tray(icon);
    tray.setToolTip('QuickOCR测试');
    
    // 设置上下文菜单
    const contextMenu = Menu.buildFromTemplate([
      { label: '这是测试菜单', type: 'normal' },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    // 设置点击行为
    if (process.platform === 'darwin') {
      tray.on('click', () => {
        tray.popUpContextMenu();
        console.log('托盘图标被点击，弹出菜单');
      });
    }
    
    console.log('托盘图标创建成功');
  } catch (error) {
    console.error('创建托盘图标失败:', error);
  }
}

// 防止应用退出
app.on('window-all-closed', (e) => {
  e.preventDefault();
  console.log('阻止应用在所有窗口关闭时退出');
}); 