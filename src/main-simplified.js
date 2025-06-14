const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 设置日志文件
const logPath = path.join(app.getPath('userData'), 'app.log');
console.log(`日志文件路径: ${logPath}`);

// 确保日志目录存在
try {
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  // 清空之前的日志文件
  fs.writeFileSync(logPath, '', 'utf8');
} catch (error) {
  console.error('日志文件操作失败:', error);
}

// 创建自定义的日志函数
const log = {
  info: function(message) {
    const logMessage = `[INFO] ${new Date().toISOString()}: ${message}`;
    console.log(logMessage);
    try { fs.appendFileSync(logPath, logMessage + '\n'); } catch (e) {}
  },
  error: function(message, error) {
    const logMessage = `[ERROR] ${new Date().toISOString()}: ${message}`;
    console.error(logMessage);
    try { 
      fs.appendFileSync(logPath, logMessage + '\n');
      if (error && error.stack) {
        fs.appendFileSync(logPath, error.stack + '\n');
      }
    } catch (e) {}
  }
};

// 记录启动信息
log.info(`应用启动，版本: ${app.getVersion()}`);

// 添加全局异常处理
process.on('uncaughtException', (error) => {
  log.error('未捕获的异常', error);
  try {
    dialog.showErrorBox('应用错误', `发生未处理的错误: ${error.message}\n\n${error.stack}`);
  } catch (dialogError) {
    log.error('显示错误对话框时出错', dialogError);
  }
});

// 配置存储
const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultConfig = {
  shortcut: process.platform === 'darwin' ? 'Shift+Command+E' : 'Shift+Ctrl+E',
  language: 'chi_sim+eng',
  autoClipboard: true,
  showNotification: true,
  showMainWindowOnStart: true
};

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
    return defaultConfig;
  } catch (error) {
    log.error('加载配置失败', error);
    return defaultConfig;
  }
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    log.error('保存配置失败', error);
  }
}

// 初始化配置
let config = loadConfig();

// 全局变量
let tray = null;
let settingsWindow = null;
let aboutWindow = null;
let mainWindow = null;

// 记录系统信息
function logSystemInfo() {
  log.info('========== 系统信息 ==========');
  log.info(`操作系统: ${process.platform} ${os.release()}`);
  log.info(`Node.js版本: ${process.versions.node}`);
  log.info(`Electron版本: ${process.versions.electron}`);
  log.info(`应用版本: ${app.getVersion()}`);
  log.info(`应用数据路径: ${app.getPath('userData')}`);
  log.info('==============================');
}

// 确保只有一个应用实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

// 创建托盘图标
function createTray() {
  log.info('开始创建托盘图标');
  try {
    // 使用文件系统中的图标
    const iconPath = path.join(__dirname, 'assets', process.platform === 'darwin' ? 'icon-mac.png' : 'icon-win.png');
    log.info(`加载图标文件: ${iconPath}`);
    
    // 检查图标文件是否存在
    if (!fs.existsSync(iconPath)) {
      log.error(`错误: 找不到图标文件: ${iconPath}`);
      throw new Error(`找不到图标文件: ${iconPath}`);
    }
    
    let icon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }
    
    tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createMainWindow();
        }
      }},
      { label: '设置', click: showSettings },
      { type: 'separator' },
      { label: '查看日志', click: () => {
        shell.openPath(logPath);
      }},
      { label: '关于', click: showAbout },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    
    tray.setToolTip('QuickOCR - 即时文字识别');
    tray.setContextMenu(contextMenu);
    
    // 点击托盘图标显示主窗口
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
      } else {
        createMainWindow();
      }
    });
    
    log.info('托盘图标创建成功');
  } catch (error) {
    log.error('创建托盘图标失败', error);
    // 确保主窗口可见，用户可以与应用交互
    if (mainWindow) {
      mainWindow.show();
    }
  }
}

// 创建主窗口
function createMainWindow() {
  log.info('创建主窗口');
  try {
    const mainHtmlPath = path.join(__dirname, 'views', 'main.html');
    log.info(`主窗口HTML路径: ${mainHtmlPath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(mainHtmlPath)) {
      log.error(`错误: 找不到main.html文件: ${mainHtmlPath}`);
      dialog.showErrorBox('启动错误', `找不到必要的文件: ${mainHtmlPath}`);
      return;
    }
    
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: config.showMainWindowOnStart,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    log.info('加载main.html文件');
    mainWindow.loadFile(mainHtmlPath).then(() => {
      log.info('main.html加载成功');
    }).catch(err => {
      log.error('main.html加载失败', err);
      dialog.showErrorBox('启动错误', `无法加载主窗口: ${err.message}`);
    });
    
    // 设置窗口菜单
    const template = [
      {
        label: '应用',
        submenu: [
          { label: '设置', click: showSettings },
          { label: '关于', click: showAbout },
          { type: 'separator' },
          { label: '退出', click: () => app.quit() }
        ]
      },
      {
        label: '帮助',
        submenu: [
          { 
            label: '报告问题', 
            click: () => shell.openExternal('https://github.com/yourname/quick-ocr/issues') 
          }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    mainWindow.setMenu(menu);
    
    // 确保窗口可见
    mainWindow.once('ready-to-show', () => {
      log.info('主窗口准备就绪');
      if (config.showMainWindowOnStart) {
        mainWindow.show();
        mainWindow.focus();
        log.info('主窗口已显示');
      }
    });
    
    mainWindow.on('closed', () => {
      log.info('主窗口已关闭');
      mainWindow = null;
    });
  } catch (error) {
    log.error('创建主窗口时出错', error);
    dialog.showErrorBox('启动错误', `创建主窗口时出错: ${error.message}`);
  }
}

// 显示设置窗口
function showSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  settingsWindow.loadFile(path.join(__dirname, 'views', 'settings.html'));
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// 显示关于窗口
function showAbout() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }
  
  aboutWindow = new BrowserWindow({
    width: 350,
    height: 300,
    resizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  aboutWindow.loadFile(path.join(__dirname, 'views', 'about.html'));
  
  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

// 设置IPC处理程序
function setupIpcHandlers() {
  // 获取设置
  ipcMain.handle('get-settings', () => {
    return config;
  });
  
  // 保存设置
  ipcMain.handle('save-settings', (event, settings) => {
    config = { ...config, ...settings };
    saveConfig(config);
    return { success: true };
  });
  
  // 打开设置窗口
  ipcMain.on('open-settings', () => {
    showSettings();
  });
}

// 当应用准备好时
app.whenReady().then(() => {
  log.info(`应用准备就绪, userData路径: ${app.getPath('userData')}`);
  
  // 记录系统信息
  logSystemInfo();
  
  // 在Dock中显示应用图标（macOS）
  if (process.platform === 'darwin') {
    app.dock.show();
    log.info('在Dock中显示应用图标');
  }
  
  // 创建窗口和托盘
  createMainWindow();
  createTray();
  
  // 设置IPC处理
  setupIpcHandlers();
  
  log.info('应用初始化完成');
}).catch(err => {
  log.error('应用启动失败', err);
  try {
    dialog.showErrorBox('启动错误', `应用启动失败: ${err.message}\n\n${err.stack}`);
  } catch (dialogError) {
    log.error('显示错误对话框时出错', dialogError);
  }
});

// 防止应用程序自动退出
app.on('window-all-closed', (e) => {
  // 阻止默认行为，除非确实需要退出
  e.preventDefault();
  log.info('阻止应用在所有窗口关闭时退出');
}); 