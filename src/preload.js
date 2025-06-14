const { contextBridge, ipcRenderer } = require('electron');

// 添加自诊断信息
console.log('预加载脚本开始执行:', new Date().toISOString());
console.log('Electron版本:', process.versions.electron);
console.log('Node版本:', process.versions.node);
console.log('预加载脚本位置:', __filename);

// 检查必要的对象和方法
if (!contextBridge) {
  console.error('contextBridge不可用，这可能导致上下文隔离失败');
}

if (!ipcRenderer) {
  console.error('ipcRenderer不可用，这将导致无法与主进程通信');
}

// 确保API可用的辅助函数
function safeIpcRendererInvoke(channel, ...args) {
  if (!ipcRenderer) {
    console.error(`无法调用ipcRenderer.invoke，channel: ${channel}`);
    return Promise.reject(new Error(`IPC通信不可用: ${channel}`));
  }
  
  console.log(`调用IPC invoke: ${channel}`);
  return ipcRenderer.invoke(channel, ...args)
    .catch(err => {
      console.error(`IPC invoke失败 (${channel}):`, err);
      throw err;
    });
}

function safeIpcRendererSend(channel, ...args) {
  if (!ipcRenderer) {
    console.error(`无法调用ipcRenderer.send，channel: ${channel}`);
    return;
  }
  
  console.log(`调用IPC send: ${channel}`);
  ipcRenderer.send(channel, ...args);
}

function safeIpcRendererOn(channel, callback) {
  if (!ipcRenderer) {
    console.error(`无法调用ipcRenderer.on，channel: ${channel}`);
    return () => {}; // 返回空的清理函数
  }
  
  console.log(`注册IPC监听: ${channel}`);
  
  // 包装回调以添加日志
  const wrappedCallback = (event, ...args) => {
    console.log(`收到IPC事件 (${channel})`);
    try {
      callback(...args);
    } catch (err) {
      console.error(`处理IPC事件时出错 (${channel}):`, err);
    }
  };
  
  // 注册监听
  ipcRenderer.on(channel, wrappedCallback);
  
  // 返回清理函数
  return () => {
    ipcRenderer.removeListener(channel, wrappedCallback);
    console.log(`移除IPC监听: ${channel}`);
  };
}

try {
  // 暴露安全的API给渲染进程
  contextBridge.exposeInMainWorld('electronAPI', {
    // 获取设置
    getSettings: () => safeIpcRendererInvoke('get-settings'),
    
    // 保存设置
    saveSettings: (settings) => safeIpcRendererInvoke('save-settings', settings),
    
    // 打开设置窗口
    openSettings: () => safeIpcRendererSend('open-settings'),
    
    // 自定义通知相关方法
    onToastData: (callback) => safeIpcRendererOn('toast-data', callback),
    
    // 关闭通知窗口
    closeToast: () => safeIpcRendererSend('close-toast'),
    
    // 国际化相关
    onI18nData: (callback) => safeIpcRendererOn('i18n-data', callback),
    
    // 获取特定的翻译文本
    getI18n: (keys) => safeIpcRendererInvoke('get-i18n-data', keys),
    
    // 获取当前使用的语言
    getCurrentLanguage: () => safeIpcRendererInvoke('get-current-language'),
    
    // 接收OCR结果
    onOcrResult: (callback) => safeIpcRendererOn('ocr-result', callback),
    
    // 接收OCR历史记录
    onOcrHistory: (callback) => safeIpcRendererOn('ocr-history', callback),
    
    // 接收OCR结果确认消息
    onOcrReceived: (callback) => safeIpcRendererOn('confirm-ocr-received', callback),
    
    // 手动请求最新OCR结果
    requestLatestOcr: () => safeIpcRendererInvoke('request-latest-ocr'),
    
    // 请求OCR历史记录
    requestOcrHistory: () => safeIpcRendererInvoke('request-ocr-history'),
    
    // 保存OCR历史记录
    saveOcrHistory: (history) => safeIpcRendererInvoke('save-ocr-history', history),
    
    // 调试: 获取历史记录文件信息
    debugGetHistory: () => safeIpcRendererInvoke('debug-get-history'),
    
    // 通用invoke接口，用于调试
    invoke: (channel, ...args) => safeIpcRendererInvoke(channel, ...args),
    
    // 添加打开外部链接的功能
    openExternalLink: (url) => safeIpcRendererSend('open-external-link', url),
    
    // 选择文件并读取内容
    selectFile: (options) => safeIpcRendererInvoke('select-file', options),
    
    // 移除监听器
    removeListener: (channel, listener) => {
      if (!ipcRenderer) {
        console.error(`无法移除监听器，channel: ${channel}`);
        return;
      }
      console.log(`移除IPC监听: ${channel}`);
      ipcRenderer.removeListener(channel, listener);
    }
  });
  
  console.log('成功暴露electronAPI到window对象');
} catch (error) {
  console.error('暴露API时出错:', error);
} 