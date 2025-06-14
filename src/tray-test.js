const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 日志记录到控制台
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// 用于存储托盘对象
let tray = null;

// 应用准备就绪时创建托盘
app.whenReady().then(() => {
  log('应用准备就绪');
  
  // 确保在macOS上隐藏dock图标
  if (process.platform === 'darwin') {
    try {
      app.dock.hide();
      log('Dock图标已隐藏');
    } catch (err) {
      log(`隐藏Dock图标时出错: ${err.message}`);
    }
  }
  
  // 设置应用为辅助程序类型
  app.setActivationPolicy('accessory');
  
  try {
    createTray();
    log('托盘创建完成');
  } catch (err) {
    log(`创建托盘时出错: ${err.message}`);
  }
  
  // 保持应用运行
  log('应用启动完成，正在运行中...');
}).catch(err => {
  log(`应用启动失败: ${err.message}`);
});

// 创建托盘图标
function createTray() {
  log('开始创建托盘图标');
  
  // 创建一个空图标作为备用
  const emptyIcon = nativeImage.createEmpty();
  
  // 获取资源路径
  const resourcePath = app.isPackaged ? process.resourcesPath : path.join(__dirname);
  log(`资源路径: ${resourcePath}`);
  
  // 尝试多个可能的图标路径
  const iconPaths = [
    path.join(resourcePath, 'assets', 'icon-mac.png'),
    path.join(resourcePath, 'assets', 'tray-icon.png'),
    path.join(__dirname, 'assets', 'icon-mac.png'),
    path.join(__dirname, 'assets', 'tray-icon.png')
  ];
  
  // 检查图标文件
  log('检查可用的图标文件:');
  let icon = null;
  
  for (const iconPath of iconPaths) {
    const exists = fs.existsSync(iconPath);
    log(`- ${iconPath}: ${exists ? '存在' : '不存在'}`);
    
    if (exists && !icon) {
      try {
        icon = nativeImage.createFromPath(iconPath);
        log(`使用图标: ${iconPath}, 尺寸: ${icon.getSize().width}x${icon.getSize().height}`);
        
        if (process.platform === 'darwin') {
          // macOS需要16x16像素的状态栏图标
          icon = icon.resize({ width: 16, height: 16 });
          // 设置为模板图像（仅适用于macOS）
          icon.setTemplateImage(true);
          log('已转换为macOS模板图标');
        }
        break;
      } catch (err) {
        log(`加载图标 ${iconPath} 失败: ${err.message}`);
      }
    }
  }
  
  // 如果没有找到有效图标，使用空图标
  if (!icon) {
    log('未找到有效图标，使用空图标');
    icon = emptyIcon;
  }
  
  // 创建托盘图标
  log('创建托盘对象...');
  tray = new Tray(icon);
  log('托盘对象已创建');
  
  // 设置工具提示
  tray.setToolTip('QuickOCR测试');
  
  // 创建上下文菜单
  const contextMenu = Menu.buildFromTemplate([
    { label: '测试项目', click: () => log('菜单项被点击') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  
  // 设置上下文菜单
  tray.setContextMenu(contextMenu);
  log('托盘菜单已设置');
  
  // 设置点击行为
  if (process.platform === 'darwin') {
    tray.on('click', () => {
      log('托盘图标被点击');
      tray.popUpContextMenu();
    });
    log('已设置macOS托盘点击行为');
  }
  
  // 保持对托盘对象的引用
  return tray;
} 