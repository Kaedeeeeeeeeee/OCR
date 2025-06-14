const { contextBridge, ipcRenderer } = require('electron');

// 添加自诊断信息
console.log('【打包版】预加载脚本开始执行:', new Date().toISOString());
console.log('Electron版本:', process.versions.electron);
console.log('Node版本:', process.versions.node);
console.log('预加载脚本位置:', __filename);

// 设置全局错误处理
process.on('uncaughtException', (error) => {
  console.error('预加载脚本未捕获错误:', error);
});

// 暴露安全的API给渲染进程
try {
  // 简化版本的API, 直接使用ipcRenderer
  contextBridge.exposeInMainWorld('electronAPI', {
    // 获取设置
    getSettings: () => ipcRenderer.invoke('get-settings'),
    
    // 保存设置
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    
    // 打开设置窗口
    openSettings: () => ipcRenderer.send('open-settings'),
    
    // 自定义通知相关方法
    onToastData: (callback) => {
      ipcRenderer.on('toast-data', (_, data) => callback(data));
    },
    
    // 关闭通知窗口
    closeToast: () => ipcRenderer.send('close-toast'),
    
    // 国际化相关
    onI18nData: (callback) => {
      ipcRenderer.on('i18n-data', (_, data) => callback(data));
    },
    
    // 获取特定的翻译文本
    getI18n: (keys) => ipcRenderer.invoke('get-i18n-data', keys),
    
    // 获取当前使用的语言
    getCurrentLanguage: () => ipcRenderer.invoke('get-current-language'),
    
    // 接收OCR结果
    onOcrResult: (callback) => {
      ipcRenderer.on('ocr-result', (_, text) => callback(text));
    }
  });
  
  console.log('成功暴露electronAPI到window对象');
} catch (error) {
  console.error('暴露API时出错:', error);
} 