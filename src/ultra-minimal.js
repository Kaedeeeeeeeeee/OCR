// 最简版本的Electron应用
const { app, BrowserWindow, dialog, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 全局变量
let mainWindow = null;
let tray = null;

// 默认配置
const defaultConfig = {
  shortcut: process.platform === 'darwin' ? 'Shift+Command+E' : 'Shift+Ctrl+E',
  language: 'chi_sim+eng',
  autoClipboard: true,
  showNotification: true,
  showMainWindowOnStart: true
};

// 简易配置管理
let config = defaultConfig;

// 记录启动信息
console.log('应用启动');

// 创建托盘图标
function createTray() {
  console.log('尝试创建托盘图标');
  try {
    // 检查图标文件
    const iconPath = path.join(__dirname, 'assets', 'icon-mac.png');
    console.log('图标路径:', iconPath);
    
    if (!fs.existsSync(iconPath)) {
      console.error('图标文件不存在:', iconPath);
      return false;
    }
    
    // 创建托盘图标
    const icon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }
    
    tray = new Tray(icon);
    tray.setToolTip('QuickOCR');
    
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示窗口', click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }},
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    
    tray.setContextMenu(contextMenu);
    console.log('托盘图标创建成功');
    return true;
  } catch (error) {
    console.error('创建托盘图标失败:', error);
    return false;
  }
}

// 设置IPC处理程序
function setupIpcHandlers() {
  console.log('设置IPC处理程序');
  
  // 获取设置
  ipcMain.handle('get-settings', () => {
    console.log('IPC: 获取设置');
    return config;
  });
  
  // 保存设置
  ipcMain.handle('save-settings', (event, settings) => {
    console.log('IPC: 保存设置', settings);
    config = { ...config, ...settings };
    return { success: true };
  });
  
  // 打开设置窗口
  ipcMain.on('open-settings', () => {
    console.log('IPC: 请求打开设置窗口');
    // 这里我们不实际打开设置窗口，只记录请求
  });
}

// 当应用准备好时
app.whenReady().then(() => {
  console.log('应用准备就绪');
  
  // 启用在Dock中显示
  app.dock.show();
  console.log('Dock图标已显示');
  
  // 创建窗口
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // 尝试加载主视图文件
  try {
    const mainHtmlPath = path.join(__dirname, 'views', 'main.html');
    console.log('尝试加载主视图文件:', mainHtmlPath);
    
    if (fs.existsSync(mainHtmlPath)) {
      console.log('主视图文件存在，正在加载');
      mainWindow.loadFile(mainHtmlPath).then(() => {
        console.log('主视图文件加载成功');
      }).catch(err => {
        console.error('主视图文件加载失败:', err);
        // 加载失败时使用默认内容
        mainWindow.loadURL('data:text/html,<html><body><h1>加载失败</h1><p>无法加载主视图文件</p></body></html>');
      });
    } else {
      console.error('主视图文件不存在:', mainHtmlPath);
      // 文件不存在时使用默认内容
      mainWindow.loadURL('data:text/html,<html><body><h1>文件不存在</h1><p>主视图文件不存在</p></body></html>');
    }
  } catch (error) {
    console.error('加载视图文件时出错:', error);
    // 出错时使用默认内容
    mainWindow.loadURL('data:text/html,<html><body><h1>错误</h1><p>加载视图文件时出错</p></body></html>');
  }
  
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    console.log('窗口已显示');
  });
  
  // 设置IPC处理程序
  setupIpcHandlers();
  
  // 创建托盘图标
  const trayCreated = createTray();
  console.log('托盘图标创建结果:', trayCreated);
  
  // 保持应用运行
  app.on('window-all-closed', e => {
    e.preventDefault();
    console.log('阻止自动退出');
  });
  
  console.log('应用初始化完成');
}).catch(err => {
  console.error('启动失败:', err);
  dialog.showErrorBox('启动错误', err.message);
}); 