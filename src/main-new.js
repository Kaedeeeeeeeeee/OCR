const { app, BrowserWindow, Tray, Menu, globalShortcut, dialog, ipcMain, clipboard, Notification, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 导入国际化模块
const { __, getLanguageData } = require('./utils/i18n');

// 全局变量
let tray = null;
let mainWindow = null;
let settingsWindow = null;
let aboutWindow = null;
let toastWindow = null;
let isProcessing = false;
let logPath = '';
let displayId = null;
let latestOcrResult = ''; // 保存最新的OCR结果
let lastOcrTime = 0; // 上次OCR时间戳
let ocrHistoryFile = path.join(app.getPath('userData'), 'ocr_history.json'); // OCR历史记录文件

// 修复应用数据目录路径
console.log('应用数据目录:', app.getPath('userData'));
console.log('历史记录文件路径:', ocrHistoryFile);

// 确保目录存在
try {
  const historyDir = path.dirname(ocrHistoryFile);
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
    console.log('创建OCR历史记录目录:', historyDir);
  }
} catch (dirError) {
  console.error('创建历史记录目录失败:', dirError);
}

// 配置
const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultConfig = {
  shortcut: process.platform === 'darwin' ? 'Shift+Command+E' : 'Shift+Ctrl+E',
  language: 'chi_sim+eng',
  languages: {
    'chi_sim': true,
    'eng': true,
    'chi_tra': false,
    'jpn': false,
    'kor': false
  },
  autoClipboard: true,
  showNotification: true,
  showMainWindowOnStart: true,
  mergeTextParagraphs: false  // 是否合并文本段落（移除多余换行）
};
let config = null;

// 在macOS上隐藏dock图标 - 这必须在app.whenReady()之前调用
if (process.platform === 'darwin') {
  try {
    app.dock.hide();
    console.log('在应用启动时隐藏Dock图标');
  } catch (err) {
    console.error('隐藏Dock图标失败:', err.message);
  }
}

// 设置日志文件
setupLogs();

// 加载配置
loadConfig();

// 选择正确的屏幕捕获方法
const { captureScreen } = process.platform === 'darwin' 
  ? require('./utils/screen-capture-mac') 
  : require('./utils/screen-capture');

// 确保只有一个应用实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('已有实例运行，退出当前实例');
  app.quit();
  process.exit(0);
}

// 应用准备就绪时的处理
app.whenReady().then(() => {
  try {
    console.log('应用准备就绪');
    
    // 设置应用为辅助程序类型
    if (process.platform === 'darwin') {
      app.setActivationPolicy('accessory');
      console.log('设置应用为辅助型应用');
    }
    
    // 检查通知权限
    checkNotificationPermission();
    
    // 记录系统信息
    logSystemInfo();
    
    // 确保OCR历史记录文件目录存在
    try {
      const historyDir = path.dirname(ocrHistoryFile);
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
        console.log('创建OCR历史记录目录:', historyDir);
      }
      
      // 检查历史记录文件是否存在
      if (!fs.existsSync(ocrHistoryFile)) {
        // 创建空的历史记录文件
        fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
        console.log('创建空的OCR历史记录文件');
      } else {
        // 验证历史记录文件格式
        try {
          const historyData = fs.readFileSync(ocrHistoryFile, 'utf8');
          if (historyData && historyData.trim() !== '') {
            // 尝试解析并验证历史记录
            const history = JSON.parse(historyData);
            if (!Array.isArray(history)) {
              console.log('历史记录不是数组格式，重置为空数组');
              fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
            } else {
              // 验证历史记录内容
              const validHistory = history.filter(item => 
                item && typeof item === 'object' && typeof item.text === 'string'
              );
              if (validHistory.length !== history.length) {
                console.log('历史记录中存在无效项，重新保存有效项');
                fs.writeFileSync(ocrHistoryFile, JSON.stringify(validHistory, null, 2), 'utf8');
              }
              console.log('OCR历史记录文件格式正确，有效记录数:', validHistory.length);
            }
          } else {
            // 文件为空，写入空数组
            fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
            console.log('OCR历史记录文件为空，已初始化');
          }
        } catch (parseError) {
          console.error('OCR历史记录文件格式无效，创建备份并重置:', parseError);
          const backupFile = `${ocrHistoryFile}.backup.${Date.now()}`;
          fs.copyFileSync(ocrHistoryFile, backupFile);
          fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
        }
      }
    } catch (fileError) {
      console.error('初始化OCR历史记录文件失败:', fileError);
    }
    
    // 创建托盘图标
    createTray();
    
    // 注册全局快捷键
    registerShortcut();
    
    // 检查权限
    checkPermissions();
    
    // 设置IPC处理
    setupIpcHandlers();
    
    // 预先创建主窗口但不显示，确保随时可以接收OCR结果
    createMainWindow(config.showMainWindowOnStart).then(() => {
      console.log('主窗口已预创建' + (config.showMainWindowOnStart ? '并显示' : '但不显示'));
    });
    
    // 处理所有窗口关闭的事件
    app.on('window-all-closed', (e) => {
      e.preventDefault();
      console.log('所有窗口已关闭，但应用保持运行');
    });
    
    console.log('应用初始化完成');
  } catch (err) {
    console.error('应用初始化出错:', err);
    dialog.showErrorBox('启动错误', `应用初始化出错: ${err.message}`);
  }
}).catch(err => {
  console.error('应用启动失败:', err);
  if (global.log) {
    global.log.error('应用启动失败:', err);
  }
});

// 监听应用退出事件
app.on('will-quit', () => {
  try {
    // 注销所有快捷键
    globalShortcut.unregisterAll();
    console.log('已注销所有全局快捷键');
    
    // 清理托盘图标
    if (tray) {
      tray = null;
      console.log('已清理托盘图标');
    }
  } catch (err) {
    console.error('应用退出处理时出错:', err);
  }
});

// 创建托盘图标
function createTray() {
  console.log('开始创建托盘图标');
  
  try {
    // 创建空图标作为备用
    const emptyIcon = nativeImage.createEmpty();
    
    // 确定资源路径
    const resourcePath = app.isPackaged ? process.resourcesPath : __dirname;
    console.log(`托盘图标资源路径: ${resourcePath}`);
    
    // 尝试多个可能的图标路径
    const iconPaths = [
      path.join(resourcePath, 'assets', 'icon-mac.png'),
      path.join(resourcePath, 'assets', 'tray-icon.png'),
      path.join(__dirname, 'assets', 'icon-mac.png'),
      path.join(__dirname, 'assets', 'tray-icon.png')
    ];
    
    // 查找图标
    console.log('检查可用图标:');
    let icon = null;
    
    for (const iconPath of iconPaths) {
      const exists = fs.existsSync(iconPath);
      console.log(`- ${iconPath}: ${exists ? '存在' : '不存在'}`);
      
      if (exists && !icon) {
        try {
          icon = nativeImage.createFromPath(iconPath);
          console.log(`使用图标: ${iconPath}`);
          
          if (process.platform === 'darwin') {
            // macOS特定处理
            icon = icon.resize({ width: 16, height: 16 });
            icon.setTemplateImage(true);
            console.log('转换为macOS模板图标');
          }
          
          break;
        } catch (err) {
          console.error(`加载图标失败: ${err.message}`);
        }
      }
    }
    
    // 如果没有找到图标，使用空图标
    if (!icon) {
      console.log('未找到图标，使用空图标');
      icon = emptyIcon;
    }
    
    // 创建托盘
    console.log('创建托盘对象...');
    tray = new Tray(icon);
    console.log('托盘对象创建成功');
    
    // 设置工具提示
    tray.setToolTip(__('tray.tooltip'));
    
    // 创建上下文菜单
    const contextMenu = Menu.buildFromTemplate([
      { label: __('tray.capture'), click: performScreenOCR },
      { label: __('tray.showMainWindow'), click: () => {
        if (mainWindow) {
          // 确保窗口显示且置于前台
          if (!mainWindow.isVisible()) {
            mainWindow.show();
          }
          mainWindow.focus();
          console.log('显示并聚焦主窗口');
        } else {
          createMainWindow(true);
          console.log('创建并显示主窗口');
        }
      }},
      { label: __('tray.settings'), click: showSettings },
      { type: 'separator' },
      { label: __('tray.about'), click: showAbout },
      { type: 'separator' },
      { label: __('tray.quit'), click: () => app.quit() }
    ]);
    
    tray.setContextMenu(contextMenu);
    console.log('托盘菜单已设置');
    
    // 设置点击行为
    if (process.platform === 'darwin') {
      tray.on('click', () => {
        console.log('托盘图标被点击');
        tray.popUpContextMenu();
      });
    } else {
      tray.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createMainWindow();
        }
      });
    }
    
    console.log('托盘图标创建完成');
  } catch (err) {
    console.error('创建托盘时出错:', err);
    dialog.showErrorBox(__('dialog.error'), __('dialog.errorDetail', { error: err.message }));
  }
}

// 执行OCR
async function performScreenOCR() {
  if (isProcessing) {
    dialog.showMessageBox({
      type: 'info',
      message: __('dialog.ocrProcessing'),
      buttons: [__('dialog.ok')]
    });
    return;
  }
  
  try {
    isProcessing = true;
    console.log('开始OCR处理流程');
    
    // 捕获屏幕
    console.log('开始捕获屏幕');
    const screenCapture = await captureScreen();
    
    // 如果用户取消了选择，screenCapture将为null
    if (!screenCapture) {
      console.log('用户取消了OCR操作');
      isProcessing = false;
      return;
    }
    
    console.log('屏幕捕获完成，图像保存在:', screenCapture);
    
    // 获取语言设置
    const language = config.language;
    console.log('使用语言配置:', language);

    try {
      // 使用Tesseract
      const tesseractOCR = require('./utils/ocr');
      const result = await tesseractOCR.performOCR(screenCapture, language);
      
      // 处理结果
      if (result) {
        processResult(result.data.text);
      } else {
        console.log('OCR返回空结果');
      }
    } catch (ocrError) {
      console.error('OCR处理出错:', ocrError);
      
      dialog.showErrorBox(__('dialog.error'), __('dialog.errorDetail', { error: ocrError.message }));
    }
    
  } catch (error) {
    console.error('屏幕OCR整体流程出错:', error);
    
    dialog.showErrorBox(__('dialog.error'), __('dialog.errorDetail', { error: error.message }));
  } finally {
    isProcessing = false;
  }
}

// 处理OCR结果
function processResult(text) {
  // 删除多余空白
  text = text.trim();
  
  if (!text) {
    console.log('识别结果为空');
    dialog.showMessageBox({
      type: 'info',
      message: __('dialog.emptyResult'),
      detail: __('dialog.tryAgain'),
      buttons: [__('dialog.ok')]
    });
    return;
  }
  
  console.log('识别结果 (长度):', text.length);
  console.log('识别结果内容:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  // 如果开启了文本段落合并选项，处理文本段落
  if (config.mergeTextParagraphs) {
    console.log('应用文本段落合并...');
    // 将多个换行替换为单个空格
    const originalText = text;
    text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('文本段落合并前后对比:');
    console.log('- 合并前长度:', originalText.length);
    console.log('- 合并后长度:', text.length);
  }
  
  // 保存最新的OCR结果
  latestOcrResult = text;
  lastOcrTime = Date.now();
  
  // 保存OCR结果到文件
  const saveResult = saveOcrResultToFile(text);
  console.log('保存OCR结果到文件结果:', saveResult ? '成功' : '失败');
  
  // 如果设置了自动复制到剪贴板
  if (config.autoClipboard) {
    clipboard.writeText(text);
    console.log('已复制到剪贴板');
  }
  
  // 如果设置了显示通知，使用自定义通知
  if (config.showNotification) {
    showToast(text);
  }
  
  // 发送OCR结果到主窗口
  sendResultToMainWindow(text);
}

// 保存OCR结果到文件
function saveOcrResultToFile(text) {
  try {
    console.log('正在保存OCR结果到文件:', ocrHistoryFile);
    console.log('文本长度:', text.length);
    
    // 检查历史记录目录是否存在，不存在则创建
    const historyDir = path.dirname(ocrHistoryFile);
    if (!fs.existsSync(historyDir)) {
      console.log('历史记录目录不存在，创建目录:', historyDir);
      fs.mkdirSync(historyDir, { recursive: true });
    }
    
    // 检查文件权限
    let canWrite = true;
    try {
      if (fs.existsSync(ocrHistoryFile)) {
        fs.accessSync(ocrHistoryFile, fs.constants.W_OK);
        console.log('历史记录文件可写');
      }
    } catch (accessError) {
      console.error('历史记录文件无写入权限:', accessError);
      canWrite = false;
      
      // 尝试创建备用文件
      ocrHistoryFile = path.join(app.getPath('temp'), 'QuickOCR_history.json');
      console.log('使用备用历史记录文件路径:', ocrHistoryFile);
    }
    
    // 读取现有历史记录
    let history = [];
    
    if (fs.existsSync(ocrHistoryFile)) {
      try {
        const historyData = fs.readFileSync(ocrHistoryFile, 'utf8');
        if (historyData && historyData.trim() !== '') {
          history = JSON.parse(historyData);
          console.log('已读取现有历史记录，共', history.length, '条');
        } else {
          console.log('历史记录文件为空');
        }
      } catch (err) {
        console.error('读取历史记录文件失败:', err);
        // 创建备份
        if (fs.existsSync(ocrHistoryFile)) {
          const backupFile = `${ocrHistoryFile}.backup.${Date.now()}`;
          fs.copyFileSync(ocrHistoryFile, backupFile);
          console.log('已创建历史记录文件备份:', backupFile);
        }
      }
    } else {
      console.log('历史记录文件不存在，将创建新文件');
    }
    
    // 确保history是数组
    if (!Array.isArray(history)) {
      console.log('历史记录不是数组，重置为空数组');
      history = [];
    }
    
    // 添加新记录到开头
    const newRecord = {
      text: text,
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString()
    };
    
    // 检查是否与最近一条记录相同
    if (history.length > 0 && history[0].text === text) {
      console.log('新结果与最近一条记录相同，更新时间戳');
      history[0] = newRecord;
    } else {
      history.unshift(newRecord);
    }
    
    // 限制历史记录数量
    const MAX_HISTORY = 5;
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    
    // 生成要保存的JSON内容
    const historyJSON = JSON.stringify(history, null, 2);
    console.log('准备写入历史记录内容长度:', historyJSON.length);
    
    // 写入文件 - 使用安全的写入方式
    try {
      // 使用临时文件写入再重命名的方式，避免写入中断导致文件损坏
      const tempFile = `${ocrHistoryFile}.temp`;
      fs.writeFileSync(tempFile, historyJSON, 'utf8');
      console.log('临时文件写入成功');
      
      // 如果目标文件存在，删除它
      if (fs.existsSync(ocrHistoryFile)) {
        fs.unlinkSync(ocrHistoryFile);
        console.log('删除旧历史记录文件');
      }
      
      // 重命名临时文件
      fs.renameSync(tempFile, ocrHistoryFile);
      console.log('临时文件重命名为正式文件成功');
      
      console.log('OCR结果已保存到文件，当前历史记录共', history.length, '条');
      return true;
    } catch (writeError) {
      console.error('写入历史记录文件失败:', writeError);
      
      // 尝试直接写入，不使用临时文件方式
      try {
        fs.writeFileSync(ocrHistoryFile, historyJSON, 'utf8');
        console.log('直接写入历史记录文件成功');
        return true;
      } catch (directWriteError) {
        console.error('直接写入历史记录文件也失败:', directWriteError);
        
        // 最后尝试写入临时目录
        try {
          const tempPath = path.join(app.getPath('temp'), 'QuickOCR_history.json');
          fs.writeFileSync(tempPath, historyJSON, 'utf8');
          console.log('成功写入临时目录历史记录:', tempPath);
          // 更新历史记录文件路径
          ocrHistoryFile = tempPath;
          return true;
        } catch (tempWriteError) {
          console.error('写入临时目录也失败:', tempWriteError);
          return false;
        }
      }
    }
  } catch (error) {
    console.error('保存OCR结果到文件失败:', error);
    return false;
  }
}

// 读取OCR历史记录
function readOcrHistoryFromFile() {
  try {
    console.log('正在读取OCR历史记录文件:', ocrHistoryFile);
    
    if (!fs.existsSync(ocrHistoryFile)) {
      console.log('OCR历史记录文件不存在，将创建新文件');
      try {
        // 确保目录存在
        const dir = path.dirname(ocrHistoryFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log('创建目录:', dir);
        }
        
        // 创建空历史记录文件
        fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
        console.log('创建了空的OCR历史记录文件');
        return [];
      } catch (createError) {
        console.error('创建历史记录文件失败:', createError);
        return [];
      }
    }
    
    // 检查文件权限
    try {
      fs.accessSync(ocrHistoryFile, fs.constants.R_OK);
    } catch (accessError) {
      console.error('无法访问历史记录文件(权限问题):', accessError);
      return [];
    }
    
    const historyData = fs.readFileSync(ocrHistoryFile, 'utf8');
    
    // 检查文件是否为空
    if (!historyData || historyData.trim() === '') {
      console.log('OCR历史记录文件为空');
      return [];
    }
    
    try {
      const history = JSON.parse(historyData);
      
      if (!Array.isArray(history)) {
        console.log('OCR历史记录不是数组格式，重置为空数组');
        fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
        return [];
      }
      
      console.log('成功读取OCR历史记录，共', history.length, '条');
      return history;
    } catch (parseError) {
      console.error('解析OCR历史记录JSON失败:', parseError);
      
      // 创建备份
      try {
        const backupFile = `${ocrHistoryFile}.backup.${Date.now()}`;
        fs.copyFileSync(ocrHistoryFile, backupFile);
        console.log('已创建损坏的历史记录文件备份:', backupFile);
      } catch (backupError) {
        console.error('创建备份文件失败:', backupError);
      }
      
      // 重置为空数组
      try {
        fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
        console.log('已重置历史记录文件为空数组');
      } catch (resetError) {
        console.error('重置历史记录文件失败:', resetError);
      }
      
      // 返回空数组
      return [];
    }
  } catch (error) {
    console.error('读取OCR历史记录失败:', error);
    // 尝试创建新的历史记录文件
    try {
      const dir = path.dirname(ocrHistoryFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
      console.log('已创建新的空历史记录文件');
    } catch (newFileError) {
      console.error('创建新历史记录文件失败:', newFileError);
    }
    return [];
  }
}

// 向主窗口发送OCR结果
function sendResultToMainWindow(text) {
  if (!mainWindow) {
    console.log('主窗口不存在，创建主窗口但不显示');
    createMainWindow(false).then(() => {
      // 主窗口创建后等待一下再发送结果
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('延迟后发送OCR结果到主窗口');
          
          // 同时发送所有历史记录和最新结果
          const history = readOcrHistoryFromFile();
          console.log('读取到历史记录数量:', history.length);
          
          // 先保存OCR结果到文件，确保历史记录中包含最新结果
          saveOcrResultToFile(text);
          
          // 重新读取历史记录，确保包含最新结果
          const updatedHistory = readOcrHistoryFromFile();
          console.log('更新后的历史记录数量:', updatedHistory.length);
          
          // 发送历史记录和结果
          try {
            mainWindow.webContents.send('ocr-history', updatedHistory);
            console.log('已发送历史记录到主窗口');
            
            setTimeout(() => {
              mainWindow.webContents.send('ocr-result', text);
              mainWindow.webContents.send('confirm-ocr-received', Date.now());
              console.log('已发送OCR结果到主窗口');
            }, 500);
          } catch (error) {
            console.error('发送数据到主窗口失败:', error);
          }
        } else {
          console.error('延迟后发送OCR结果失败：主窗口不可用');
        }
      }, 1000);
    });
    return;
  }
  
  // 先保存OCR结果到文件，确保历史记录中包含最新结果
  saveOcrResultToFile(text);
  
  // 不再自动显示主窗口，只发送结果
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('发送OCR结果到主窗口');
    
    // 确保主窗口已完成加载
    if (mainWindow.webContents.isLoading()) {
      console.log('主窗口仍在加载，等待加载完成后发送结果');
      mainWindow.webContents.once('did-finish-load', () => {
        console.log('主窗口加载完成，现在发送OCR结果');
        
        // 重新读取历史记录，确保包含最新结果
        const history = readOcrHistoryFromFile();
        console.log('读取到历史记录数量:', history.length);
        
        // 发送历史记录和结果
        try {
          mainWindow.webContents.send('ocr-history', history);
          console.log('已发送历史记录到主窗口');
          
          setTimeout(() => {
            mainWindow.webContents.send('ocr-result', text);
            mainWindow.webContents.send('confirm-ocr-received', Date.now());
            console.log('已发送OCR结果到主窗口');
          }, 500);
        } catch (error) {
          console.error('发送数据到主窗口失败:', error);
        }
      });
    } else {
      // 重新读取历史记录，确保包含最新结果
      const history = readOcrHistoryFromFile();
      console.log('读取到历史记录数量:', history.length);
      
      // 发送历史记录和结果
      try {
        mainWindow.webContents.send('ocr-history', history);
        console.log('已发送历史记录到主窗口');
        
        setTimeout(() => {
          mainWindow.webContents.send('ocr-result', text);
          mainWindow.webContents.send('confirm-ocr-received', Date.now());
          console.log('已发送OCR结果到主窗口');
        }, 500);
      } catch (error) {
        console.error('发送数据到主窗口失败:', error);
      }
    }
  } else {
    console.error('发送OCR结果失败：主窗口不可用');
  }
}

// 显示自定义通知
function showToast(text) {
  console.log('显示自定义通知...');
  
  // 关闭已存在的通知窗口
  if (toastWindow && !toastWindow.isDestroyed()) {
    try {
      toastWindow.close();
      toastWindow = null;
    } catch (error) {
      console.error('关闭旧通知窗口时出错:', error);
    }
  }
  
  // 获取屏幕尺寸
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  try {
    // 创建新的通知窗口
    toastWindow = new BrowserWindow({
      width: 300,
      height: 120,
      x: Math.round(width / 2 - 150),  // 居中
      y: Math.round(height * 0.75),    // 靠下显示
      frame: false,                    // 无边框
      transparent: true,               // 透明背景
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,                     // 先不显示
      focusable: false,                // 不可获取焦点
      hasShadow: false,                // 禁用默认阴影
      backgroundColor: '#00000000',    // 完全透明的背景
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        devTools: !app.isPackaged // 仅在开发环境允许开发者工具
      }
    });
    
    // 确定视图文件路径
    let viewPath;
    if (app.isPackaged) {
      viewPath = path.join(process.resourcesPath, 'views', 'toast.html');
    } else {
      viewPath = path.join(__dirname, 'views', 'toast.html');
    }
    
    // 加载通知视图
    toastWindow.loadFile(viewPath).then(() => {
      // 发送数据到通知窗口
      toastWindow.webContents.send('toast-data', { 
        text,
        message: __('toast.copied')
      });
      
      // 显示通知窗口
      toastWindow.show();
      
      // 为调试目的
      if (!app.isPackaged && process.env.DEBUG === 'true') {
        toastWindow.webContents.openDevTools({ mode: 'detach' });
      }
      
      // 设置自动关闭计时器
      setTimeout(() => {
        if (toastWindow && !toastWindow.isDestroyed()) {
          toastWindow.close();
          toastWindow = null;
        }
      }, 3000); // 3秒后自动关闭
    }).catch(err => {
      console.error('加载通知视图失败:', err);
    });
    
    // 窗口失去焦点时自动关闭
    toastWindow.on('blur', () => {
      if (toastWindow && !toastWindow.isDestroyed()) {
        toastWindow.close();
        toastWindow = null;
      }
    });
    
    // 窗口关闭时清理引用
    toastWindow.on('closed', () => {
      toastWindow = null;
    });
  } catch (error) {
    console.error('创建通知窗口时出错:', error);
  }
}

// 创建主窗口
async function createMainWindow(shouldShow = true) {
  console.log('创建主窗口, 显示参数:', shouldShow);
  
  // 如果窗口已存在则返回或聚焦
  if (mainWindow) {
    if (shouldShow && mainWindow.isMinimized()) {
      mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      console.log('已恢复并聚焦现有主窗口');
    } else if (shouldShow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      console.log('已显示并聚焦现有主窗口');
    } else if (shouldShow) {
      mainWindow.focus();
      console.log('已聚焦现有主窗口');
    }
    return mainWindow;
  }
  
  try {
    // 确保预加载脚本路径正确
    const preloadPath = getPreloadPath();
    
    // 检查预加载脚本是否存在
    if (!fs.existsSync(preloadPath)) {
      console.error('预加载脚本不存在:', preloadPath);
      dialog.showErrorBox('错误', `预加载脚本不存在: ${preloadPath}`);
    } else {
      console.log('预加载脚本存在:', preloadPath);
    }
    
    // 创建新窗口
    mainWindow = new BrowserWindow({
      width: 550,
      height: 500,
      minWidth: 400,
      minHeight: 300,
      title: 'QuickOCR',
      show: false, // 先不显示，等加载完成后再显示
      icon: getAppIcon(),
      webPreferences: {
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // 禁用沙箱以确保预加载脚本可以执行
        worldSafeExecuteJavaScript: true,
        devTools: !app.isPackaged // 仅在开发环境允许开发者工具
      }
    });
    
    console.log('主窗口已创建');
    
    // 处理窗口关闭
    mainWindow.on('closed', () => {
      mainWindow = null;
      console.log('主窗口已关闭');
    });
    
    // 加载主页面
    let viewPath;
    if (app.isPackaged) {
      viewPath = path.join(process.resourcesPath, 'views', 'main.html');
    } else {
      viewPath = path.join(__dirname, 'views', 'main.html');
    }
    
    // 检查视图文件是否存在
    if (!fs.existsSync(viewPath)) {
      console.error('主窗口视图文件不存在:', viewPath);
      dialog.showErrorBox('错误', `找不到视图文件: ${viewPath}`);
      return null;
    }
    
    console.log('加载主页面:', viewPath);
    await mainWindow.loadFile(viewPath);
    console.log('主页面加载完成');
    
    // 页面加载完成后执行
    mainWindow.webContents.on('did-finish-load', () => {
      try {
        console.log('主窗口页面加载完成，准备发送初始数据');
        
        // 发送国际化文本
        try {
          mainWindow.webContents.send('i18n-data', {
            title: __('main.title'),
            shortcutTip: __('main.shortcutTip'),
            clearResults: __('main.clearResults'),
            copyText: __('main.copyText'),
            noResults: __('main.noResults')
          });
          console.log('已发送国际化数据到主窗口');
        } catch (i18nError) {
          console.error('发送国际化数据失败:', i18nError);
        }
        
        // 读取并发送历史记录
        setTimeout(() => {
          try {
            const history = readOcrHistoryFromFile();
            console.log('读取到历史记录条数:', history.length);
            
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('ocr-history', history);
              console.log('已发送历史记录到主窗口', history.length, '条');
            }
          } catch (historyError) {
            console.error('发送历史记录失败:', historyError);
          }
        }, 1000);
        
        // 显示窗口（如果需要）
        if (shouldShow) {
          mainWindow.show();
          mainWindow.focus();
          console.log('已显示主窗口');
        }
      } catch (error) {
        console.error('处理主窗口加载完成事件时出错:', error);
      }
    });
  } catch (error) {
    console.error('创建主窗口时出错:', error);
  }
  
  return mainWindow;
}

// 显示设置窗口
function showSettings() {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  
  console.log('创建设置窗口');
  
  // 确保预加载脚本路径正确
  const preloadPath = getPreloadPath();
  
  // 检查预加载脚本是否存在
  if (!fs.existsSync(preloadPath)) {
    console.error('预加载脚本不存在:', preloadPath);
    dialog.showErrorBox('错误', `预加载脚本不存在: ${preloadPath}`);
    return;
  } else {
    console.log('预加载脚本存在:', preloadPath);
  }
  
  // 创建设置窗口
  try {
    settingsWindow = new BrowserWindow({
      width: 550,
      height: 600,
      title: __('settings.title'),
      icon: getAppIcon(),
      resizable: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: !app.isPackaged, // 仅在开发环境允许开发者工具
        worldSafeExecuteJavaScript: true,
        sandbox: false // 禁用沙箱以确保预加载脚本可以执行
      }
    });
    
    // 确定视图文件路径
    let viewPath;
    if (app.isPackaged) {
      viewPath = path.join(process.resourcesPath, 'views', 'settings.html');
    } else {
      viewPath = path.join(__dirname, 'views', 'settings.html');
    }
    
    console.log('加载设置视图:', viewPath);
    
    // 先检查文件是否存在
    if (!fs.existsSync(viewPath)) {
      console.error('设置视图文件不存在:', viewPath);
      dialog.showErrorBox(__('dialog.error'), __('dialog.errorDetail', { error: '无法加载设置界面文件' }));
      return;
    }
    
    // 注入测试代码以确认预加载脚本是否生效
    settingsWindow.webContents.on('did-finish-load', () => {
      try {
        console.log('设置窗口加载完成');
        
        // 发送国际化数据
        const i18nData = {
          title: __('settings.title'),
          shortcut: __('settings.shortcut'),
          shortcutTip: __('settings.shortcutTip'),
          language: __('settings.language'),
          languageTip: __('settings.languageTip'),
          chineseSimplified: __('settings.chineseSimplified'),
          chineseTraditional: __('settings.chineseTraditional'),
          english: __('settings.english'),
          japanese: __('settings.japanese'),
          korean: __('settings.korean'),
          autoClipboard: __('settings.autoClipboard'),
          showNotification: __('settings.showNotification'),
          showMainWindowOnStart: __('settings.showMainWindowOnStart'),
          mergeParagraphs: __('settings.mergeParagraphs'),
          mergeParagraphsTip: __('settings.mergeParagraphsTip'),
          save: __('settings.save'),
          saved: __('settings.saved')
        };
        
        console.log('发送国际化数据');
        settingsWindow.webContents.send('i18n-data', i18nData);
      } catch (error) {
        console.error('初始化设置窗口失败:', error);
      }
    });
    
    // 加载HTML文件
    settingsWindow.loadFile(viewPath);
    
    // 捕获错误
    settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('加载设置页面失败:', errorCode, errorDescription);
    });
    
    // 添加自定义监听
    settingsWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`设置页面控制台(${level}):`, message);
    });
    
    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
  } catch (error) {
    console.error('创建设置窗口出错:', error);
    dialog.showErrorBox('错误', `创建设置窗口时出错: ${error.message}`);
  }
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
    title: __('about.title'),
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged // 仅在开发环境允许开发者工具
    }
  });
  
  // 确定视图文件路径
  let viewPath;
  if (app.isPackaged) {
    viewPath = path.join(process.resourcesPath, 'views', 'about.html');
  } else {
    viewPath = path.join(__dirname, 'views', 'about.html');
  }
  
  aboutWindow.loadFile(viewPath);
  
  // 关于窗口加载完成后发送国际化数据
  aboutWindow.webContents.on('did-finish-load', () => {
    // 发送国际化文本到关于窗口
    aboutWindow.webContents.send('i18n-data', {
      title: __('about.title'),
      version: __('about.version', { version: app.getVersion() }),
      description: __('about.description'),
      copyright: __('about.copyright', { year: new Date().getFullYear() })
    });
  });
  
  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

// 注册全局快捷键
function registerShortcut() {
  console.log('开始注册全局快捷键');
  // 先注销已注册的快捷键
  globalShortcut.unregisterAll();
  
  const shortcut = config.shortcut;
  console.log('尝试注册快捷键:', shortcut);
  
  const ret = globalShortcut.register(shortcut, performScreenOCR);

  if (!ret) {
    console.error('快捷键注册失败');
    dialog.showMessageBox({
      type: 'error',
      title: __('dialog.shortcutTitle'),
      message: __('dialog.shortcutFailed', { shortcut }),
      detail: __('dialog.shortcutFailedDetail'),
      buttons: [__('dialog.understand')]
    });
  } else {
    console.log('快捷键注册成功');
  }
}

// 设置IPC处理程序
function setupIpcHandlers() {
  // 获取设置
  ipcMain.handle('get-settings', () => {
    return config;
  });
  
  // 保存设置
  ipcMain.handle('save-settings', (event, settings) => {
    console.log('收到保存设置请求:', settings);
    
    try {
      // 合并设置，确保保留languages对象
      config = { 
        ...config, 
        ...settings 
      };
      
      // 保存到文件
      const saveResult = saveConfig(config);
      
      // 重新注册快捷键（如果快捷键被更改）
      if (settings.shortcut) {
        registerShortcut();
      }
      
      return { success: saveResult };
    } catch (error) {
      console.error('保存设置时出错:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });
  
  // 打开设置窗口
  ipcMain.on('open-settings', () => {
    showSettings();
  });
  
  // 关闭通知窗口
  ipcMain.on('close-toast', () => {
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.close();
    }
  });
  
  // 获取国际化数据
  ipcMain.handle('get-i18n-data', (event, keys) => {
    const result = {};
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        result[key] = __(key);
      });
    }
    return result;
  });
  
  // 获取当前语言
  ipcMain.handle('get-current-language', () => {
    return getLanguageData();
  });
  
  // 处理请求最新OCR结果的请求
  ipcMain.handle('request-latest-ocr', () => {
    console.log('收到请求获取最新OCR结果');
    if (latestOcrResult) {
      console.log('返回缓存的OCR结果，长度:', latestOcrResult.length);
      return latestOcrResult;
    } else {
      console.log('没有可用的OCR结果缓存');
      return '';
    }
  });
  
  // 处理请求OCR历史记录的请求
  ipcMain.handle('request-ocr-history', () => {
    console.log('收到请求获取OCR历史记录');
    
    try {
      // 打印当前历史记录文件信息
      console.log('当前历史记录文件路径:', ocrHistoryFile);
      console.log('历史记录文件是否存在:', fs.existsSync(ocrHistoryFile));
      
      // 验证文件权限
      let hasReadPermission = false;
      try {
        if (fs.existsSync(ocrHistoryFile)) {
          fs.accessSync(ocrHistoryFile, fs.constants.R_OK);
          hasReadPermission = true;
          console.log('历史记录文件可读');
        } else {
          console.log('历史记录文件不存在，将创建新文件');
          // 创建目录和空文件
          const historyDir = path.dirname(ocrHistoryFile);
          if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
            console.log('创建历史记录目录:', historyDir);
          }
          fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
          console.log('创建了空的历史记录文件');
          hasReadPermission = true;
        }
      } catch (accessError) {
        console.error('历史记录文件无读取权限:', accessError);
        // 尝试使用临时目录创建历史记录文件
        ocrHistoryFile = path.join(app.getPath('temp'), 'QuickOCR_history.json');
        console.log('使用临时目录历史记录文件:', ocrHistoryFile);
        
        if (!fs.existsSync(ocrHistoryFile)) {
          fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
          console.log('在临时目录创建了空的历史记录文件');
        }
      }
      
      // 如果没有读取权限，返回空数组
      if (!hasReadPermission) {
        console.log('无法读取历史记录文件，返回空数组');
        return [];
      }
      
      // 直接从文件重新读取，确保获取最新数据
      console.log('直接从文件读取最新历史记录');
      
      let history;
      
      // 尝试直接读取文件
      try {
        const historyData = fs.readFileSync(ocrHistoryFile, 'utf8');
        
        // 记录读取到的内容以便调试
        console.log('读取到的历史记录文件内容长度:', historyData.length);
        console.log('历史记录文件内容片段:', historyData.substring(0, 100) + (historyData.length > 100 ? '...' : ''));
        
        if (historyData && historyData.trim() !== '') {
          history = JSON.parse(historyData);
          console.log('解析历史记录JSON成功，记录数:', history.length);
        } else {
          console.log('历史记录文件为空');
          history = [];
        }
      } catch (readError) {
        console.error('读取历史记录文件失败:', readError);
        
        // 尝试创建一个新的历史记录文件
        try {
          fs.writeFileSync(ocrHistoryFile, '[]', 'utf8');
          console.log('历史记录文件已重置');
        } catch (resetError) {
          console.error('重置历史记录文件失败:', resetError);
        }
        
        // 使用辅助函数读取历史
        history = readOcrHistoryFromFile();
      }
      
      // 验证历史记录
      console.log('返回OCR历史记录，共', history ? history.length : 0, '条');
      
      // 确保历史记录是有效的数组
      if (!Array.isArray(history)) {
        console.log('历史记录不是数组，返回空数组');
        return [];
      }
      
      // 验证每条记录的有效性
      const validHistory = history.filter(item => 
        item && typeof item === 'object' && typeof item.text === 'string'
      );
      
      if (validHistory.length !== history.length) {
        console.log('历史记录中存在无效项，过滤后剩余', validHistory.length, '条');
      }
      
      // 如果历史记录为空但有最新结果，将最新结果添加到历史记录
      if (validHistory.length === 0 && latestOcrResult && latestOcrResult.length > 0) {
        console.log('历史记录为空但有最新结果，添加到历史记录');
        const newRecord = {
          text: latestOcrResult,
          timestamp: new Date().toISOString(),
          time: new Date().toLocaleTimeString()
        };
        
        // 写入文件
        try {
          fs.writeFileSync(ocrHistoryFile, JSON.stringify([newRecord], null, 2), 'utf8');
          console.log('已将最新结果保存到历史记录文件');
          return [newRecord];
        } catch (error) {
          console.error('保存最新结果到历史记录文件失败:', error);
        }
      }
      
      // 打印返回内容帮助调试
      console.log('历史记录数据类型:', typeof validHistory);
      console.log('历史记录内容示例:', 
        validHistory.length > 0 
          ? JSON.stringify(validHistory[0]).substring(0, 100) + '...' 
          : '无内容'
      );
      
      return validHistory;
    } catch (error) {
      console.error('请求历史记录处理失败:', error);
      
      // 创建一个测试历史记录以确保界面显示正常
      const testRecord = {
        text: '历史记录加载失败。如果您看到此消息，请尝试执行新的OCR操作生成新的历史记录。',
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString()
      };
      
      return [testRecord];
    }
  });
  
  // 处理保存OCR历史记录的请求
  ipcMain.handle('save-ocr-history', (event, history) => {
    console.log('收到保存OCR历史记录请求，共', history.length, '条');
    try {
      fs.writeFileSync(ocrHistoryFile, JSON.stringify(history, null, 2), 'utf8');
      console.log('OCR历史记录已保存到文件');
      return { success: true };
    } catch (error) {
      console.error('保存OCR历史记录失败:', error);
      return { success: false, error: error.message };
    }
  });
  
  // 注册额外的调试IPC处理程序
  ipcMain.handle('debug-get-history', () => {
    console.log('[调试] 请求历史记录数据用于调试');
    try {
      const historyExists = fs.existsSync(ocrHistoryFile);
      let historyContent = '';
      let parsedHistory = null;
      
      if (historyExists) {
        historyContent = fs.readFileSync(ocrHistoryFile, 'utf8');
        try {
          parsedHistory = JSON.parse(historyContent);
        } catch (e) {
          parsedHistory = `解析失败: ${e.message}`;
        }
      }
      
      return {
        historyFile: ocrHistoryFile,
        exists: historyExists,
        content: historyExists ? historyContent : '文件不存在',
        parsed: parsedHistory,
        latestOcrResult: latestOcrResult ? latestOcrResult.substring(0, 100) + (latestOcrResult.length > 100 ? '...' : '') : null
      };
    } catch (error) {
      console.error('[调试] 获取历史记录信息失败:', error);
      return {
        error: error.message,
        stack: error.stack
      };
    }
  });

  // 处理打开外部链接的请求
  ipcMain.on('open-external-link', (event, url) => {
    console.log('收到打开外部链接请求:', url);
    try {
      // 安全检查：确保URL是有效的HTTP/HTTPS链接
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        shell.openExternal(url);
        console.log('已打开外部链接');
      } else {
        console.error('拒绝打开可能不安全的URL:', url);
      }
    } catch (error) {
      console.error('打开外部链接失败:', error);
    }
  });

  // 处理文件选择请求
  ipcMain.handle('select-file', async (event, options) => {
    console.log('收到选择文件请求:', options);
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }],
        title: options?.title || '选择文件'
      });
      
      console.log('文件选择结果:', result);
      
      if (result.canceled || result.filePaths.length === 0) {
        console.log('用户取消了文件选择');
        return null;
      }
      
      const filePath = result.filePaths[0];
      console.log('选择的文件路径:', filePath);
      
      // 如果需要读取文件内容
      if (options?.readFile) {
        try {
          const content = fs.readFileSync(filePath, options.encoding || 'utf8');
          return {
            path: filePath,
            content,
            success: true
          };
        } catch (readError) {
          console.error('读取文件内容失败:', readError);
          return {
            path: filePath,
            error: readError.message,
            success: false
          };
        }
      }
      
      return {
        path: filePath,
        success: true
      };
    } catch (error) {
      console.error('选择文件出错:', error);
      return {
        error: error.message,
        success: false
      };
    }
  });
}

// 检查权限
function checkPermissions() {
  console.log('检查权限');
  
  if (process.platform === 'darwin') {
    try {
      const { systemPreferences } = require('electron');
      
      // 检查屏幕录制权限
      const hasScreenCapturePermission = systemPreferences.getMediaAccessStatus('screen');
      console.log('屏幕录制权限状态:', hasScreenCapturePermission);
      
      if (hasScreenCapturePermission !== 'granted') {
        console.log('需要屏幕录制权限');
        
        // 显示权限提示对话框
        dialog.showMessageBox({
          type: 'info',
          title: __('dialog.permissionTitle'),
          message: __('dialog.permissionScreenCapture'),
          detail: __('dialog.permissionScreenDetail'),
          buttons: [__('dialog.understand')],
          defaultId: 0
        });
      }
      
      // 检查通知权限（仅在打包环境下）
      if (app.isPackaged && config.showNotification) {
        console.log('检查通知权限');
        // 使用测试通知检查权限
        new Notification({
          title: __('toast.ready'),
          body: __('toast.useShortcut'),
          silent: true
        }).show();
      }
    } catch (error) {
      console.error('检查权限时出错:', error);
    }
  }
}

// 加载配置
function loadConfig() {
  try {
    console.log(`尝试从以下路径加载配置: ${configPath}`);
    // 打印用户数据路径，便于调试
    console.log(`应用用户数据路径: ${app.getPath('userData')}`);
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      console.log(`读取到配置数据长度: ${configData.length} 字节`);
      console.log(`配置文件内容: ${configData}`);
      
      try {
        const parsedConfig = JSON.parse(configData);
        console.log('解析后的配置:', parsedConfig);
        
        // 确保languages对象存在
        if (!parsedConfig.languages && parsedConfig.language) {
          console.log('配置中没有languages对象，根据language创建');
          parsedConfig.languages = {
            'chi_sim': parsedConfig.language.includes('chi_sim'),
            'chi_tra': parsedConfig.language.includes('chi_tra'),
            'eng': parsedConfig.language.includes('eng'),
            'jpn': parsedConfig.language.includes('jpn'),
            'kor': parsedConfig.language.includes('kor')
          };
        }
        
        // 合并默认配置和加载的配置
        config = { ...JSON.parse(JSON.stringify(defaultConfig)), ...parsedConfig };
        console.log('成功加载并解析配置');
      } catch (parseError) {
        console.error('配置文件解析失败:', parseError);
        console.log('将使用默认配置');
        config = JSON.parse(JSON.stringify(defaultConfig));
        
        // 备份损坏的配置文件
        const backupPath = `${configPath}.backup.${Date.now()}`;
        fs.copyFileSync(configPath, backupPath);
        console.log(`已将损坏的配置文件备份到: ${backupPath}`);
      }
    } else {
      console.log('配置文件不存在，将使用默认配置');
      config = JSON.parse(JSON.stringify(defaultConfig));
      
      // 尝试立即保存默认配置
      try {
        saveConfig(JSON.parse(JSON.stringify(defaultConfig)));
        console.log('已保存默认配置文件');
      } catch (saveError) {
        console.error('保存默认配置失败:', saveError);
      }
    }
    
    // 确保config不是undefined或null
    if (!config) {
      console.log('配置对象为空，使用默认配置');
      config = JSON.parse(JSON.stringify(defaultConfig));
    }
    
    // 确保所有必要的字段都存在
    if (!config.shortcut) {
      config.shortcut = defaultConfig.shortcut;
      console.log('配置中缺少shortcut字段，使用默认值');
    }
    
    if (!config.language) {
      config.language = defaultConfig.language;
      console.log('配置中缺少language字段，使用默认值');
    }
    
    if (!config.languages) {
      config.languages = JSON.parse(JSON.stringify(defaultConfig.languages));
      console.log('配置中缺少languages字段，使用默认值');
    }
    
    console.log('最终加载的配置:', config);
  } catch (error) {
    console.error('加载配置失败:', error);
    config = JSON.parse(JSON.stringify(defaultConfig));
    
    // 在发生严重错误时通知用户
    if (app.isReady()) {
      dialog.showErrorBox('配置加载错误', `无法加载配置: ${error.message}\n将使用默认设置。`);
    }
  }
}

// 保存配置
function saveConfig(configToSave) {
  try {
    // 确保用户数据目录存在
    const userDataPath = app.getPath('userData');
    const configDir = path.dirname(configPath);
    
    console.log(`保存配置到: ${configPath}`);
    console.log(`确保目录存在: ${configDir}`);
    
    // 添加时间戳到日志
    console.log(`保存配置开始时间: ${new Date().toISOString()}`);
    
    // 确保配置目录存在
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o755 });
        console.log(`创建了配置目录: ${configDir}`);
      } catch (mkdirError) {
        console.error(`创建配置目录失败: ${mkdirError.message}`);
        throw new Error(`无法创建配置目录: ${mkdirError.message}`);
      }
    }
    
    // 确保配置不是undefined或null，且包含所有必要字段
    if (!configToSave) {
      throw new Error('配置对象为空');
    }
    
    // 确保有快捷键设置
    if (!configToSave.shortcut) {
      configToSave.shortcut = process.platform === 'darwin' ? 'Shift+Command+E' : 'Shift+Ctrl+E';
      console.log('配置中缺少shortcut字段，使用默认值');
    }
    
    // 确保有语言设置
    if (!configToSave.language) {
      const langs = [];
      if (configToSave.languages) {
        if (configToSave.languages.chi_sim) langs.push('chi_sim');
        if (configToSave.languages.chi_tra) langs.push('chi_tra');
        if (configToSave.languages.eng) langs.push('eng');
        if (configToSave.languages.jpn) langs.push('jpn');
        if (configToSave.languages.kor) langs.push('kor');
      }
      if (langs.length === 0) langs.push('eng');
      configToSave.language = langs.join('+');
      console.log('配置中缺少language字段，根据languages创建:', configToSave.language);
    }
    
    // 确保有languages对象
    if (!configToSave.languages) {
      configToSave.languages = {
        'chi_sim': configToSave.language.includes('chi_sim'),
        'chi_tra': configToSave.language.includes('chi_tra'),
        'eng': configToSave.language.includes('eng'),
        'jpn': configToSave.language.includes('jpn'),
        'kor': configToSave.language.includes('kor')
      };
      console.log('配置中缺少languages对象，根据language创建');
    }
    
    // 检查目录是否可写
    try {
      const testFile = path.join(configDir, '.write_test');
      fs.writeFileSync(testFile, 'test', { flag: 'w' });
      fs.unlinkSync(testFile);
      console.log('确认目录可写');
    } catch (accessError) {
      console.error(`配置目录不可写: ${accessError.message}`);
      throw new Error(`配置目录不可写: ${accessError.message}`);
    }
    
    // 准备配置数据
    const configJson = JSON.stringify(configToSave, null, 2);
    console.log(`准备保存的配置内容长度: ${configJson.length} 字节`);
    
    // 尝试多种方式保存配置
    let saved = false;
    
    // 方式1：直接写入
    try {
      console.log('尝试直接写入配置文件');
      fs.writeFileSync(configPath, configJson, 'utf8');
      console.log('直接写入成功');
      saved = true;
    } catch (directWriteError) {
      console.error('直接写入失败:', directWriteError);
      
      // 方式2：先写入临时文件，然后重命名
      try {
        console.log('尝试通过临时文件写入');
        const tempPath = `${configPath}.temp`;
        fs.writeFileSync(tempPath, configJson, 'utf8');
        
        // 在某些平台上，重命名文件可能会失败，如果目标文件已存在
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }
        
        // 重命名临时文件为最终配置文件
        fs.renameSync(tempPath, configPath);
        console.log('通过临时文件写入成功');
        saved = true;
      } catch (tempFileError) {
        console.error('通过临时文件写入失败:', tempFileError);
        
        // 方式3：使用备份目录
        try {
          console.log('尝试在备份目录中保存');
          const backupDir = path.join(app.getPath('userData'), 'backup');
          if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
          }
          
          const backupPath = path.join(backupDir, 'config.json');
          fs.writeFileSync(backupPath, configJson, 'utf8');
          console.log(`配置已保存到备份位置: ${backupPath}`);
          
          // 尝试复制到主配置
          try {
            fs.copyFileSync(backupPath, configPath);
            console.log('从备份复制到主配置成功');
            saved = true;
          } catch (copyError) {
            console.error('从备份复制到主配置失败:', copyError);
          }
        } catch (backupError) {
          console.error('保存到备份目录失败:', backupError);
        }
      }
    }
    
    if (!saved) {
      throw new Error('无法使用任何方法保存配置');
    }
    
    console.log(`配置成功保存到: ${configPath}`);
    console.log(`保存配置结束时间: ${new Date().toISOString()}`);
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    
    // 在UI中显示错误
    if (app.isReady()) {
      dialog.showErrorBox('保存设置失败', `无法保存设置: ${error.message}\n请检查应用权限并重试。`);
    }
    
    return false;
  }
}

// 设置日志系统
function setupLogs() {
  try {
    // 创建日志目录
    const logDir = path.join(app.getPath('userData'));
    
    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      console.log(`创建日志目录: ${logDir}`);
    } else {
      console.log(`日志目录已存在: ${logDir}`);
    }
    
    // 设置日志文件路径
    logPath = path.join(logDir, 'app.log');
    console.log(`日志文件路径: ${logPath}`);
    
    // 创建或清空日志文件
    try {
      fs.writeFileSync(logPath, `=== QuickOCR 应用日志 开始于 ${new Date().toISOString()} ===\n`, { flag: 'w' });
      console.log('日志文件已初始化');
    } catch (error) {
      console.error('创建日志文件失败:', error);
    }
    
    // 创建简单的日志对象
    global.log = {
      info: (message, ...args) => {
        const logEntry = `[INFO] ${new Date().toISOString()} - ${message} ${args.length > 0 ? JSON.stringify(args) : ''}`;
        console.log(logEntry);
        try {
          fs.appendFileSync(logPath, logEntry + '\n');
        } catch (error) {
          console.error('写入日志失败:', error);
        }
      },
      error: (message, ...args) => {
        const logEntry = `[ERROR] ${new Date().toISOString()} - ${message} ${args.length > 0 ? JSON.stringify(args) : ''}`;
        console.error(logEntry);
        try {
          fs.appendFileSync(logPath, logEntry + '\n');
          
          // 同时写入到错误日志
          const errorLogPath = path.join(logDir, 'error.log');
          fs.appendFileSync(errorLogPath, logEntry + '\n');
        } catch (error) {
          console.error('写入错误日志失败:', error);
        }
      }
    };
    
    // 设置未捕获异常的处理
    process.on('uncaughtException', (err) => {
      if (global.log) {
        global.log.error('未捕获异常:', err);
      } else {
        console.error('未捕获异常:', err);
        try {
          fs.appendFileSync(logPath, `[ERROR] ${new Date().toISOString()} - 未捕获异常: ${err.stack || err}\n`);
        } catch (error) {
          console.error('写入未捕获异常日志失败:', error);
        }
      }
    });
    
    console.log('日志系统初始化完成');
  } catch (err) {
    console.error('设置日志系统失败:', err);
  }
}

// 记录系统信息
function logSystemInfo() {
  console.log('========== 系统信息 ==========');
  console.log(`操作系统: ${process.platform} ${os.release()}`);
  console.log(`Node.js版本: ${process.versions.node}`);
  console.log(`Electron版本: ${process.versions.electron}`);
  console.log(`应用版本: ${app.getVersion()}`);
  console.log(`应用数据路径: ${app.getPath('userData')}`);
  console.log('==============================');
}

// 获取应用图标
function getAppIcon() {
  // 定义可能的图标路径
  const resourcePath = app.isPackaged ? process.resourcesPath : __dirname;
  const iconName = process.platform === 'darwin' ? 'icon-mac.png' : 'icon-win.png';
  
  const possiblePaths = [
    path.join(resourcePath, 'assets', iconName),
    path.join(__dirname, 'assets', iconName)
  ];
  
  // 查找第一个存在的图标路径
  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }
  
  // 如果找不到，返回null
  console.warn('找不到应用图标');
  return null;
}

// 检查通知权限
function checkNotificationPermission() {
  if (process.platform === 'darwin') {
    try {
      // 检查是否有通知权限
      if (Notification.isSupported()) {
        console.log('系统支持通知');
        
        // 检查是否已授权显示通知
        if (!app.isPackaged) {
          // 开发模式下直接请求权限
          new Notification({
            title: 'QuickOCR',
            body: '应用已启动，准备就绪',
            silent: true
          }).show();
          console.log('已发送测试通知');
        }
      } else {
        console.log('系统不支持通知');
      }
    } catch (error) {
      console.error('检查通知权限时出错:', error);
    }
  }
}

// 确保预加载脚本路径正确
function getPreloadPath() {
  if (app.isPackaged) {
    // 在打包环境中，预加载脚本应该在resources目录下
    return path.join(process.resourcesPath, 'preload.js');
  } else {
    // 在开发环境中，预加载脚本在src目录
    return path.join(__dirname, 'preload.js');
  }
} 