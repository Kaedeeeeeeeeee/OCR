const { app, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 在macOS上隐藏dock图标
if (process.platform === 'darwin') {
  app.dock.hide();
}

let tray = null;

app.whenReady().then(() => {
  console.log('App ready');
  
  // 在macOS上，设置应用为辅助型应用
  if (process.platform === 'darwin') {
    app.setActivationPolicy('accessory');
  }
  
  try {
    // 创建托盘图标
    console.log('Creating tray icon...');
    
    // 使用空图标作为备用
    const emptyIcon = nativeImage.createEmpty();
    
    // 测试多个可能的图标路径
    const iconPaths = [
      path.join(__dirname, 'assets', 'icon-mac.png'),
      path.join(__dirname, 'assets', 'tray-icon.png')
    ];
    
    let icon = null;
    
    // 查找图标文件
    for (const iconPath of iconPaths) {
      console.log(`Checking icon: ${iconPath}, exists: ${fs.existsSync(iconPath)}`);
      
      if (fs.existsSync(iconPath)) {
        try {
          icon = nativeImage.createFromPath(iconPath);
          console.log(`Using icon: ${iconPath}`);
          
          if (process.platform === 'darwin') {
            // macOS适配
            icon = icon.resize({ width: 16, height: 16 });
            icon.setTemplateImage(true);
            console.log('Converted to template image');
          }
          
          break;
        } catch (err) {
          console.error(`Error loading icon: ${err.message}`);
        }
      }
    }
    
    // 如果未找到图标，使用空图标
    if (!icon) {
      console.log('No icon found, using empty icon');
      icon = emptyIcon;
    }
    
    console.log('Creating tray with icon...');
    tray = new Tray(icon);
    console.log('Tray created successfully');
    
    tray.setToolTip('QuickOCR Test');
    
    const menu = Menu.buildFromTemplate([
      { label: 'Test Item', click: () => console.log('Menu item clicked') },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() }
    ]);
    
    tray.setContextMenu(menu);
    console.log('Context menu set');
    
    // macOS点击行为
    if (process.platform === 'darwin') {
      tray.on('click', () => {
        console.log('Tray icon clicked');
        tray.popUpContextMenu();
      });
    }
    
    console.log('Tray setup complete');
  } catch (error) {
    console.error('Error creating tray:', error);
  }
}); 