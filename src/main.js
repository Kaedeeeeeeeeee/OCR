const { app, BrowserWindow, Tray, Menu, globalShortcut, dialog, ipcMain, screen, clipboard, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 捕获全局异常，在应用任何部分发生错误时进行日志记录
process.on('uncaughtException', (error) => {
  console.error('全局未捕获异常:', error);
  
  try {
    const errorLogPath = path.join(app.getPath('userData'), 'error.log');
    fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] 未捕获异常: ${error.message}\n${error.stack}\n\n`);
    
    try {
      dialog.showErrorBox('启动错误', `应用启动时出现问题: ${error.message}\n\n请检查错误日志: ${errorLogPath}`);
    } catch (e) {
      console.error('无法显示错误对话框:', e);
    }
  } catch (logError) {
    console.error('无法写入错误日志:', logError);
  }
});

// 异步错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  
  try {
    const errorLogPath = path.join(app.getPath('userData'), 'error.log');
    fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] 未处理的Promise拒绝: ${reason}\n\n`);
  } catch (logError) {
    console.error('无法写入错误日志:', logError);
  }
});

// 打印关键路径信息
try {
  // 检查是否是打包后的应用
  const isPackaged = app.isPackaged;
  
  console.log('===== 应用路径信息 =====');
  console.log(`应用状态: ${isPackaged ? '已打包' : '开发模式'}`);
  console.log('应用路径:', app.getAppPath());
  console.log('进程当前目录:', process.cwd());
  console.log('userData路径:', app.getPath('userData'));
  console.log('可执行文件路径:', app.getPath('exe'));
  console.log('应用名称:', app.getName());
  console.log('应用版本:', app.getVersion());
  
  if (isPackaged) {
    console.log('资源路径:', process.resourcesPath);
    
    // 打印可用的资源文件
    try {
      console.log('检查资源文件:');
      if (fs.existsSync(process.resourcesPath)) {
        const resourceFiles = fs.readdirSync(process.resourcesPath);
        console.log('资源目录内容:', resourceFiles);
        
        // 检查关键子目录
        const dirsToCheck = ['assets', 'views', 'utils'];
        dirsToCheck.forEach(dir => {
          const dirPath = path.join(process.resourcesPath, dir);
          if (fs.existsSync(dirPath)) {
            console.log(`${dir}目录存在, 内容:`, fs.readdirSync(dirPath));
          } else {
            console.log(`${dir}目录不存在!`);
          }
        });
      } else {
        console.log('资源路径不存在!');
      }
    } catch (e) {
      console.error('无法列出资源文件:', e);
    }
  }
  console.log('======================');
} catch (e) {
  console.error('获取路径信息时出错:', e);
}

// 设置日志文件
try {
  const logPath = path.join(app.getPath('userData'), 'app.log');
  console.log(`日志文件路径: ${logPath}`);
  
  // 确保日志目录存在
  try {
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    console.error('创建日志目录失败:', error);
  }
  
  // 清空之前的日志文件
  try {
    fs.writeFileSync(logPath, '', 'utf8');
  } catch (error) {
    console.error('清空日志文件失败:', error);
  }
  
  // 创建自定义的日志函数，将输出同时写入控制台和日志文件
  global.log = {
    info: function(message) {
      const logMessage = `[INFO] ${new Date().toISOString()}: ${message}`;
      console.log(logMessage);
      try {
        fs.appendFileSync(logPath, logMessage + '\n');
      } catch (err) {
        console.error('写入日志失败:', err);
      }
    },
    error: function(message, error) {
      const logMessage = `[ERROR] ${new Date().toISOString()}: ${message}`;
      console.error(logMessage);
      try {
        fs.appendFileSync(logPath, logMessage + '\n');
        if (error && error.stack) {
          fs.appendFileSync(logPath, error.stack + '\n');
        }
      } catch (err) {
        console.error('写入错误日志失败:', err);
      }
    }
  };
  
  // 将console替换为日志函数，确保所有输出都写入文件
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  console.log = function(...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    
    originalConsoleLog.apply(console, args);
    try {
      fs.appendFileSync(logPath, `[LOG] ${new Date().toISOString()}: ${message}\n`);
    } catch (err) {
      originalConsoleError('写入日志失败:', err);
    }
  };
  
  console.error = function(...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    
    originalConsoleError.apply(console, args);
    try {
      fs.appendFileSync(logPath, `[ERROR] ${new Date().toISOString()}: ${message}\n`);
    } catch (err) {
      originalConsoleError('写入错误日志失败:', err);
    }
  };
  
  // 记录启动信息
  global.log.info(`应用启动，版本: ${app.getVersion()}`);
  global.log.info(`打包状态: ${app.isPackaged ? '已打包' : '开发模式'}`);
} catch (error) {
  console.error('初始化日志系统失败:', error);
}

// 为了调试，先不隐藏Dock图标，等应用完全初始化后再隐藏

// 记录系统信息
function logSystemInfo() {
  global.log.info('========== 系统信息 ==========');
  global.log.info(`操作系统: ${process.platform} ${os.release()}`);
  global.log.info(`Node.js版本: ${process.versions.node}`);
  global.log.info(`Electron版本: ${process.versions.electron}`);
  global.log.info(`应用版本: ${app.getVersion()}`);
  global.log.info(`应用数据路径: ${app.getPath('userData')}`);
  
  // 检查sharp库
  try {
    const sharp = require('sharp');
    global.log.info(`Sharp版本: ${sharp.versions.sharp}`);
  } catch (error) {
    global.log.error('加载Sharp库失败', error);
  }
  
  global.log.info('==============================');
}

// 直接使用node的文件系统来模拟配置存储
const configPath = path.join(app.getPath('userData'), 'config.json');
// 根据平台选择屏幕捕获方法
const { captureScreen } = process.platform === 'darwin' 
  ? require('./utils/screen-capture-mac') 
  : require('./utils/screen-capture');
const { performOCR } = require('./utils/ocr');

// 配置存储
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
    global.log.error('加载配置失败:', error);
    return defaultConfig;
  }
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    global.log.error('保存配置失败:', error);
  }
}

// 初始化配置
let config = loadConfig();

// 全局变量
let tray = null;
let settingsWindow = null;
let aboutWindow = null;
let mainWindow = null;
let isProcessing = false;

// 确保只有一个应用实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

// 当应用准备好时
app.whenReady().then(() => {
  try {
    global.log.info(`应用准备就绪, userData路径: ${app.getPath('userData')}`);
    
    // 设置应用为辅助程序类型（必须在最前面）
    if (process.platform === 'darwin') {
      app.setActivationPolicy('accessory');
      global.log.info('设置应用为辅助型应用');
    }
    
    // 创建托盘
    try {
      global.log.info('开始创建托盘图标和菜单');
      createTray();
      global.log.info('托盘图标创建完成');
      
      // 在托盘创建后再隐藏Dock图标，防止应用过早退出
      if (process.platform === 'darwin') {
        if (app.dock) {
          app.dock.hide();
          global.log.info('托盘创建后隐藏Dock图标');
        }
      }
    } catch (uiError) {
      global.log.error('创建托盘时出错', uiError);
      dialog.showErrorBox('托盘错误', `创建托盘图标时出错: ${uiError.message}`);
    }
    
    // 记录系统信息
    try {
      logSystemInfo();
    } catch (sysInfoError) {
      global.log.error('记录系统信息时出错', sysInfoError);
    }
    
    // 创建主窗口
    try {
      global.log.info('开始创建主窗口');
      createMainWindow();
      global.log.info('主窗口创建完成');
    } catch (uiError) {
      global.log.error('创建用户界面时出错', uiError);
      dialog.showErrorBox('界面错误', `创建应用界面时出错: ${uiError.message}`);
    }
    
    // 确保应用保持运行（解决早期退出问题）
    app.on('window-all-closed', function(e) {
      e.preventDefault();
      global.log.info('阻止所有窗口关闭时退出');
    });
    
    // 设置IPC处理
    try {
      setupIpcHandlers();
      global.log.info('IPC处理器设置完成');
    } catch (ipcError) {
      global.log.error('设置IPC处理器时出错', ipcError);
    }
    
    // 快捷键注册和权限检查
    try {
      registerShortcut();
      global.log.info('快捷键注册完成');
    } catch (shortcutError) {
      global.log.error('注册快捷键时出错', shortcutError);
    }
    
    try {
      checkPermissions();
      global.log.info('权限检查完成');
    } catch (permError) {
      global.log.error('检查权限时出错', permError);
    }
    
    global.log.info('应用初始化完成');
  } catch (error) {
    global.log.error('应用初始化过程中出错', error);
    dialog.showErrorBox('启动错误', `应用初始化过程中出错: ${error.message}`);
  }
}).catch(err => {
  global.log.error('应用启动失败', err);
  try {
    dialog.showErrorBox('启动错误', `应用启动失败: ${err.message}\n\n${err.stack}`);
  } catch (dialogError) {
    global.log.error('显示错误对话框失败', dialogError);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// 确保在macOS上，任何窗口创建后都保持Dock图标隐藏
app.on('browser-window-created', () => {
  if (process.platform === 'darwin') {
    app.dock.hide();
    global.log.info('窗口创建后保持Dock图标隐藏');
  }
});

// 在退出前注销所有快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 创建主窗口
function createMainWindow() {
  global.log.info('创建主窗口');
  try {
    // 确保资源路径正确（打包和非打包环境）
    const resourcePath = app.isPackaged 
      ? path.join(process.resourcesPath) 
      : __dirname;
    
    const mainHtmlPath = path.join(resourcePath, 'views', 'main.html');
    global.log.info(`主窗口HTML路径: ${mainHtmlPath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(mainHtmlPath)) {
      global.log.error(`错误: 找不到main.html文件: ${mainHtmlPath}`);
      // 尝试备用路径
      const altPath = path.join(__dirname, 'views', 'main.html');
      global.log.info(`尝试备用路径: ${altPath}`);
      
      if (fs.existsSync(altPath)) {
        global.log.info(`找到备用路径的main.html文件`);
        mainWindow = new BrowserWindow({
          width: 800,
          height: 600,
          show: true, // 在开发和调试阶段显示窗口
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
          }
        });
        
        mainWindow.loadFile(altPath).then(() => {
          global.log.info('main.html加载成功(备用路径)');
        }).catch(err => {
          global.log.error('main.html加载失败(备用路径)', err);
          throw err;
        });
      } else {
        throw new Error(`找不到必要的文件: ${mainHtmlPath} 和 ${altPath}`);
      }
    } else {
      mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true, // 在开发和调试阶段显示窗口，以便进行调试
        webPreferences: {
          preload: path.join(resourcePath, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      global.log.info('加载main.html文件');
      mainWindow.loadFile(mainHtmlPath).then(() => {
        global.log.info('main.html加载成功');
      }).catch(err => {
        global.log.error('main.html加载失败', err);
        throw err;
      });
    }
    
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
    
    // 开发模式开启开发者工具
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
      global.log.info('开发模式: 已开启开发者工具');
    }
    
    // 确保窗口可见
    mainWindow.once('ready-to-show', () => {
      global.log.info('主窗口准备就绪');
      if (config.showMainWindowOnStart) {
        mainWindow.show();
        mainWindow.focus();
        global.log.info('主窗口已显示');
      }
    });
    
    // 窗口关闭时清理对象引用
    mainWindow.on('closed', () => {
      global.log.info('主窗口已关闭');
      mainWindow = null;
    });
    
    return true;
  } catch (error) {
    global.log.error('创建主窗口时出错', error);
    try {
      dialog.showErrorBox('启动错误', `创建主窗口时出错: ${error.message}\n\n这可能是因为无法找到或加载必要的文件。`);
    } catch (dialogErr) {
      global.log.error('显示错误对话框失败', dialogErr);
    }
    return false;
  }
}

// 创建托盘图标及菜单
function createTray() {
  global.log.info('开始创建托盘图标');
  
  try {
    // 使用NativeImage API创建图标
    const { nativeImage } = require('electron');
    let icon;
    
    // 创建一个空图标作为备用
    const emptyIcon = nativeImage.createEmpty();
    
    // 确定资源路径
    const resourcePath = app.isPackaged ? process.resourcesPath : __dirname;
    global.log.info(`资源路径: ${resourcePath}`);
    
    // 尝试多个可能的图标路径
    const iconPaths = [
      path.join(resourcePath, 'assets', 'icon-mac.png'),
      path.join(resourcePath, 'assets', 'tray-icon.png'),
      path.join(__dirname, 'assets', 'icon-mac.png'),
      path.join(__dirname, 'assets', 'tray-icon.png')
    ];
    
    // 检查所有可能的图标位置
    global.log.info('检查可用图标:');
    let foundIcon = false;
    
    for (const iconPath of iconPaths) {
      const exists = fs.existsSync(iconPath);
      global.log.info(`- ${iconPath}: ${exists ? '存在' : '不存在'}`);
      
      if (exists && !foundIcon) {
        try {
          icon = nativeImage.createFromPath(iconPath);
          global.log.info(`使用图标: ${iconPath}, 尺寸: ${icon.getSize().width}x${icon.getSize().height}`);
          
          // macOS特定处理
          if (process.platform === 'darwin') {
            icon = icon.resize({ width: 16, height: 16 });
            icon.setTemplateImage(true);
            global.log.info('已转换为macOS模板图标');
          }
          
          foundIcon = true;
          break;
        } catch (err) {
          global.log.error(`加载图标 ${iconPath} 失败:`, err);
        }
      }
    }
    
    // 如果未找到有效图标，使用空图标
    if (!foundIcon) {
      global.log.info('未找到有效图标，使用空图标');
      icon = emptyIcon;
    }
    
    // 创建托盘图标
    global.log.info('创建托盘对象...');
    tray = new Tray(icon);
    global.log.info('托盘对象已创建');
    
    // 设置工具提示
    tray.setToolTip('QuickOCR - 即时文字识别');
    
    // 创建上下文菜单
    const contextMenu = Menu.buildFromTemplate([
      { label: '截图识别文字', click: async () => {
        if (isProcessing) {
          dialog.showMessageBox({
            type: 'info',
            message: '已有OCR处理正在进行',
            buttons: ['确定']
          });
          return;
        }
        
        try {
          isProcessing = true;
          global.log.info('开始OCR处理流程');
          
          // 捕获屏幕
          global.log.info('开始捕获屏幕');
          const screenCapture = await captureScreen();
          
          // 如果用户取消了选择，screenCapture将为null
          if (!screenCapture) {
            global.log.info('用户取消了OCR操作');
            return;
          }
          
          global.log.info('屏幕捕获完成，图像保存在:', screenCapture);
          
          // OCR识别
          const language = config.language;
          global.log.info('开始OCR识别，使用语言:', language);
          const result = await performOCR(screenCapture, language);
          global.log.info('OCR识别完成');
          
          // 处理结果
          processResult(result);
        } catch (error) {
          global.log.error('OCR处理出错:', error);
          dialog.showErrorBox('OCR错误', '文字识别过程中出现错误: ' + error.message);
        } finally {
          isProcessing = false;
          global.log.info('OCR处理流程结束');
        }
      }},
      { label: '显示主窗口', click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createMainWindow();
          mainWindow.show();
        }
      }},
      { label: '设置', click: showSettings },
      { type: 'separator' },
      { label: '查看日志', click: () => {
        shell.openPath(path.join(app.getPath('userData'), 'app.log'));
      }},
      { label: '关于', click: showAbout },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    
    // 设置上下文菜单
    tray.setContextMenu(contextMenu);
    global.log.info('托盘菜单已设置');
    
    // 设置点击行为
    if (process.platform === 'darwin') {
      tray.on('click', () => {
        global.log.info('托盘图标被点击');
        tray.popUpContextMenu();
      });
      global.log.info('已设置托盘点击行为');
    } else {
      // Windows和Linux上点击托盘显示主窗口
      tray.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createMainWindow();
          mainWindow.show();
        }
      });
    }
    
    global.log.info('托盘图标创建完成');
    return true;
  } catch (error) {
    global.log.error('创建托盘图标失败', error);
    try {
      dialog.showErrorBox('托盘图标错误', `创建托盘图标失败: ${error.message}`);
    } catch (dialogErr) {
      global.log.error('显示错误对话框失败', dialogErr);
    }
    return false;
  }
}

// 检查必要的权限
function checkPermissions() {
  global.log.info('检查权限');
  
  if (process.platform === 'darwin') {
    // 在macOS上，检查系统权限
    try {
      const { systemPreferences } = require('electron');
      
      // 检查屏幕录制权限
      const hasScreenCapturePermission = systemPreferences.getMediaAccessStatus('screen');
      global.log.info('屏幕录制权限状态:', hasScreenCapturePermission);
      
      if (hasScreenCapturePermission !== 'granted') {
        global.log.info('需要屏幕录制权限');
        
        // 显示权限提示对话框
        dialog.showMessageBox({
          type: 'info',
          title: '需要权限',
          message: '需要屏幕录制权限才能进行OCR',
          detail: '请前往系统偏好设置 > 安全性与隐私 > 隐私 > 屏幕录制，确保QuickOCR已被勾选。\n\n设置完成后，请重启应用。',
          buttons: ['了解'],
          defaultId: 0
        });
      }
    } catch (error) {
      global.log.error('检查权限时出错:', error);
    }
  }
}

// 注册全局快捷键
function registerShortcut() {
  global.log.info('开始注册全局快捷键');
  // 先注销已注册的快捷键
  globalShortcut.unregisterAll();
  
  const shortcut = config.shortcut;
  global.log.info('尝试注册快捷键:', shortcut);
  
  const ret = globalShortcut.register(shortcut, async () => {
    global.log.info('快捷键被触发');
    if (isProcessing) {
      global.log.info('已有OCR处理正在进行，忽略此次触发');
      return;
    }
    
    try {
      isProcessing = true;
      global.log.info('开始OCR处理流程');
      
      // 捕获屏幕
      global.log.info('开始捕获屏幕');
      const screenCapture = await captureScreen();
      
      // 如果用户取消了选择，screenCapture将为null
      if (!screenCapture) {
        global.log.info('用户取消了OCR操作');
        return;
      }
      
      global.log.info('屏幕捕获完成，图像保存在:', screenCapture);
      
      // OCR识别
      const language = config.language;
      global.log.info('开始OCR识别，使用语言:', language);
      const result = await performOCR(screenCapture, language);
      global.log.info('OCR识别完成');
      
      // 处理结果
      processResult(result);
    } catch (error) {
      global.log.error('OCR处理出错:', error);
      dialog.showErrorBox('OCR错误', '文字识别过程中出现错误: ' + error.message);
    } finally {
      isProcessing = false;
      global.log.info('OCR处理流程结束');
    }
  });

  if (!ret) {
    global.log.error('快捷键注册失败');
    dialog.showMessageBox({
      type: 'error',
      title: '快捷键注册失败',
      message: `无法注册快捷键: ${shortcut}`,
      detail: '这可能是因为该快捷键已被其他应用占用，或者您需要授予辅助功能权限。\n\n请前往系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能，确保QuickOCR已被授权。',
      buttons: ['了解']
    });
  } else {
    global.log.info('快捷键注册成功');
  }
}

// 处理OCR结果
function processResult(result) {
  const text = result.data.text.trim();
  
  if (!text) {
    dialog.showMessageBox({
      type: 'info',
      message: '未识别到文字',
      buttons: ['确定']
    });
    return;
  }
  
  // 如果设置了自动复制到剪贴板
  if (config.autoClipboard) {
    clipboard.writeText(text);
  }
  
  // 如果开启了通知
  if (config.showNotification) {
    new Notification({
      title: 'OCR完成',
      body: `已识别文字${text.length > 30 ? '并复制到剪贴板' : ': ' + text}`,
      silent: false
    }).show();
  }
}

// 显示设置窗口
function showSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  
  // 确保在打开设置窗口前隐藏Dock图标
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true, // 确保窗口始终在前台
    skipTaskbar: true, // 在任务栏中隐藏
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
  
  // 确保在打开关于窗口前隐藏Dock图标
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  aboutWindow = new BrowserWindow({
    width: 350,
    height: 300,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true, // 确保窗口始终在前台
    skipTaskbar: true, // 在任务栏中隐藏
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
    
    // 重新注册快捷键（如果快捷键被更改）
    if (settings.shortcut) {
      registerShortcut();
    }
    
    return { success: true };
  });
  
  // 打开设置窗口
  ipcMain.on('open-settings', () => {
    showSettings();
  });
} 