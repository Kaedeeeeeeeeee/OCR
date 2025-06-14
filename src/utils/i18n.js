const { app } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');

// 支持的语言
const SUPPORTED_LANGUAGES = ['ja-JP', 'zh-CN', 'en-US'];
const DEFAULT_LANGUAGE = 'en-US';

// 翻译数据
const translations = {
  'zh-CN': {
    // 托盘菜单
    'tray.capture': '截图识别文字',
    'tray.showMainWindow': '显示主窗口',
    'tray.settings': '设置',
    'tray.viewLogs': '查看日志',
    'tray.about': '关于',
    'tray.quit': '退出',
    'tray.tooltip': 'QuickOCR - 即时文字识别',
    
    // 主窗口
    'main.title': 'QuickOCR - 文字识别结果',
    'main.shortcutTip': '使用快捷键 {shortcut} 随时识别屏幕上的文字',
    'main.clearResults': '清除历史',
    'main.copyText': '复制文本',
    'main.noResults': '尚无识别结果',
    
    // 设置窗口
    'settings.title': 'QuickOCR - 设置',
    'settings.shortcut': 'OCR快捷键',
    'settings.shortcutTip': '使用 \'+\' 分隔按键。支持的修饰键: Shift, Control/Ctrl, Command/Cmd (Mac), Option/Alt, Super.',
    'settings.language': 'OCR语言',
    'settings.languageTip': '可同时选择多种语言进行识别',
    'settings.chineseSimplified': '中文(简体)',
    'settings.chineseTraditional': '中文(繁体)',
    'settings.english': '英文',
    'settings.japanese': '日文',
    'settings.korean': '韩文',
    'settings.autoClipboard': '自动复制识别结果到剪贴板',
    'settings.showNotification': '显示识别完成通知',
    'settings.showMainWindowOnStart': '启动时显示主窗口',
    'settings.mergeParagraphs': '合并文本段落（移除多余换行）',
    'settings.mergeParagraphsTip': '开启后，OCR识别的文本将自动合并成连续段落，适合识别书籍、文章等多行文本',
    'settings.save': '保存设置',
    'settings.saved': '设置已保存',
    
    // 通知
    'toast.copied': '文本已复制到剪贴板',
    'toast.ready': 'QuickOCR 准备就绪',
    'toast.useShortcut': '现在可以使用快捷键进行OCR识别',
    
    // 对话框
    'dialog.ocrProcessing': '已有OCR处理正在进行',
    'dialog.ok': '确定',
    'dialog.confirm': '确认',
    'dialog.cancel': '取消',
    'dialog.understand': '了解',
    'dialog.emptyResult': '未能识别到文字',
    'dialog.tryAgain': '请尝试选择更清晰的文本区域，或调整语言设置。',
    'dialog.permissionTitle': '需要权限',
    'dialog.permissionScreenCapture': '需要屏幕录制权限才能进行OCR',
    'dialog.permissionScreenDetail': '请前往系统偏好设置 > 安全性与隐私 > 隐私 > 屏幕录制，确保QuickOCR已被勾选。\n\n设置完成后，请重启应用。',
    'dialog.shortcutTitle': '快捷键注册失败',
    'dialog.shortcutFailed': '无法注册快捷键: {shortcut}',
    'dialog.shortcutFailedDetail': '这可能是因为该快捷键已被其他应用占用，或者您需要授予辅助功能权限。\n\n请前往系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能，确保QuickOCR已被授权。',
    'dialog.error': '错误',
    'dialog.errorDetail': '{error}',
    
    // 关于窗口
    'about.title': '关于 QuickOCR',
    'about.version': '版本: {version}',
    'about.description': '一个跨平台的即时OCR软件，可通过快捷键快速识别屏幕上的文字。',
    'about.copyright': '© {year} QuickOCR 团队',
  },
  
  'en-US': {
    // Tray menu
    'tray.capture': 'Capture & Recognize Text',
    'tray.showMainWindow': 'Show Main Window',
    'tray.settings': 'Settings',
    'tray.viewLogs': 'View Logs',
    'tray.about': 'About',
    'tray.quit': 'Quit',
    'tray.tooltip': 'QuickOCR - Instant Text Recognition',
    
    // Main window
    'main.title': 'QuickOCR - Text Recognition Results',
    'main.shortcutTip': 'Use shortcut {shortcut} to recognize text on screen anytime',
    'main.clearResults': 'Clear History',
    'main.copyText': 'Copy Text',
    'main.noResults': 'No recognition results yet',
    
    // Settings window
    'settings.title': 'QuickOCR - Settings',
    'settings.shortcut': 'OCR Shortcut',
    'settings.shortcutTip': 'Use \'+\' to separate keys. Supported modifiers: Shift, Control/Ctrl, Command/Cmd (Mac), Option/Alt, Super.',
    'settings.language': 'OCR Language',
    'settings.languageTip': 'Multiple languages can be selected for recognition',
    'settings.chineseSimplified': 'Chinese (Simplified)',
    'settings.chineseTraditional': 'Chinese (Traditional)',
    'settings.english': 'English',
    'settings.japanese': 'Japanese',
    'settings.korean': 'Korean',
    'settings.autoClipboard': 'Automatically copy recognition results to clipboard',
    'settings.showNotification': 'Show notification when recognition is complete',
    'settings.showMainWindowOnStart': 'Show main window at startup',
    'settings.mergeParagraphs': 'Merge text paragraphs (remove extra line breaks)',
    'settings.mergeParagraphsTip': 'When enabled, recognized text will be automatically merged into continuous paragraphs, ideal for books, articles, and other multi-line text',
    'settings.save': 'Save Settings',
    'settings.saved': 'Settings Saved',
    
    // Toast notification
    'toast.copied': 'Text copied to clipboard',
    'toast.ready': 'QuickOCR is ready',
    'toast.useShortcut': 'Now you can use the shortcut for OCR recognition',
    
    // Dialogs
    'dialog.ocrProcessing': 'OCR processing already in progress',
    'dialog.ok': 'OK',
    'dialog.confirm': 'Confirm',
    'dialog.cancel': 'Cancel',
    'dialog.understand': 'Got it',
    'dialog.emptyResult': 'No text recognized',
    'dialog.tryAgain': 'Please try selecting a clearer text area, or adjust language settings.',
    'dialog.permissionTitle': 'Permission Required',
    'dialog.permissionScreenCapture': 'Screen recording permission is required for OCR',
    'dialog.permissionScreenDetail': 'Please go to System Preferences > Security & Privacy > Privacy > Screen Recording, and make sure QuickOCR is checked.\n\nPlease restart the app after setting permissions.',
    'dialog.shortcutTitle': 'Shortcut Registration Failed',
    'dialog.shortcutFailed': 'Unable to register shortcut: {shortcut}',
    'dialog.shortcutFailedDetail': 'This may be because the shortcut is already in use by another application, or you need to grant accessibility permissions.\n\nPlease go to System Preferences > Security & Privacy > Privacy > Accessibility, and make sure QuickOCR is authorized.',
    'dialog.error': 'Error',
    'dialog.errorDetail': '{error}',
    
    // About window
    'about.title': 'About QuickOCR',
    'about.version': 'Version: {version}',
    'about.description': 'A cross-platform instant OCR software that quickly recognizes text on screen using hotkeys.',
    'about.copyright': '© {year} QuickOCR Team',
  },
  
  'ja-JP': {
    // トレイメニュー
    'tray.capture': 'テキスト認識',
    'tray.showMainWindow': 'メインウィンドウを表示',
    'tray.settings': '設定',
    'tray.viewLogs': 'ログを表示',
    'tray.about': 'について',
    'tray.quit': '終了',
    'tray.tooltip': 'QuickOCR - 瞬時テキスト認識',
    
    // メインウィンドウ
    'main.title': 'QuickOCR - テキスト認識結果',
    'main.shortcutTip': 'ショートカット {shortcut} を使用していつでも画面上のテキストを認識できます',
    'main.clearResults': '履歴をクリア',
    'main.copyText': 'テキストをコピー',
    'main.noResults': '認識結果はまだありません',
    
    // 設定ウィンドウ
    'settings.title': 'QuickOCR - 設定',
    'settings.shortcut': 'OCRショートカット',
    'settings.shortcutTip': '\'+\'を使用してキーを区切ります。サポートされている修飾キー: Shift, Control/Ctrl, Command/Cmd (Mac), Option/Alt, Super.',
    'settings.language': 'OCR言語',
    'settings.languageTip': '認識のために複数の言語を選択できます',
    'settings.chineseSimplified': '中国語（簡体字）',
    'settings.chineseTraditional': '中国語（繁体字）',
    'settings.english': '英語',
    'settings.japanese': '日本語',
    'settings.korean': '韓国語',
    'settings.autoClipboard': '認識結果を自動的にクリップボードにコピー',
    'settings.showNotification': '認識完了時に通知を表示',
    'settings.showMainWindowOnStart': '起動時にメインウィンドウを表示',
    'settings.mergeParagraphs': 'テキスト段落を結合（余分な改行を削除）',
    'settings.mergeParagraphsTip': '有効にすると、OCR認識されたテキストは自動的に連続した段落に結合されます。書籍、記事などの複数行テキストの認識に最適です',
    'settings.save': '設定を保存',
    'settings.saved': '設定が保存されました',
    
    // トースト通知
    'toast.copied': 'テキストがクリップボードにコピーされました',
    'toast.ready': 'QuickOCRの準備ができました',
    'toast.useShortcut': 'ショートカットを使用してOCR認識ができるようになりました',
    
    // ダイアログ
    'dialog.ocrProcessing': 'OCR処理がすでに進行中です',
    'dialog.ok': 'OK',
    'dialog.confirm': '確認',
    'dialog.cancel': 'キャンセル',
    'dialog.understand': '理解しました',
    'dialog.emptyResult': 'テキストが認識されませんでした',
    'dialog.tryAgain': 'より明確なテキスト領域を選択するか、言語設定を調整してください。',
    'dialog.permissionTitle': '権限が必要です',
    'dialog.permissionScreenCapture': 'OCRにはスクリーン録画の権限が必要です',
    'dialog.permissionScreenDetail': 'システム環境設定 > セキュリティとプライバシー > プライバシー > 画面収録に移動し、QuickOCRがチェックされていることを確認してください。\n\n権限を設定した後、アプリを再起動してください。',
    'dialog.shortcutTitle': 'ショートカット登録に失敗しました',
    'dialog.shortcutFailed': 'ショートカットを登録できません: {shortcut}',
    'dialog.shortcutFailedDetail': 'これは、ショートカットが他のアプリケーションですでに使用されているか、アクセシビリティ権限を付与する必要があるためかもしれません。\n\nシステム環境設定 > セキュリティとプライバシー > プライバシー > アクセシビリティに移動し、QuickOCRが承認されていることを確認してください。',
    'dialog.error': 'エラー',
    'dialog.errorDetail': '{error}',
    
    // バージョン情報ウィンドウ
    'about.title': 'QuickOCRについて',
    'about.version': 'バージョン: {version}',
    'about.description': 'ホットキーを使用して画面上のテキストをすばやく認識するクロスプラットフォームの瞬時OCRソフトウェアです。',
    'about.copyright': '© {year} QuickOCRチーム',
  }
};

// 获取系统语言
function getSystemLocale() {
  try {
    // 尝试多种方式获取系统语言
    console.log('开始检测系统语言...');
    
    // 1. 尝试从Electron app获取语言
    let locale = app.getLocale();
    console.log('Electron app.getLocale() 返回:', locale);
    
    // 2. 尝试获取系统环境变量
    const osLocale = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '';
    console.log('系统环境变量语言:', osLocale);
    
    // 尝试检测日语优先
    if (locale.includes('ja') || (osLocale && osLocale.includes('ja'))) {
      console.log('明确检测到日语，设置为ja-JP');
      return 'ja-JP';
    }
    
    // 处理中文
    if (locale.includes('zh') || (osLocale && osLocale.includes('zh'))) {
      console.log('检测到中文，使用zh-CN');
      return 'zh-CN';
    }
    
    // 处理英文
    if (locale.includes('en') || (osLocale && osLocale.includes('en'))) {
      console.log('检测到英语，使用en-US');
      return 'en-US';
    }
    
    // 如果无法明确检测，使用完整的locale匹配
    for (const lang of SUPPORTED_LANGUAGES) {
      if (locale.startsWith(lang.split('-')[0])) {
        console.log(`检测到语言前缀匹配 ${lang}`);
        return lang;
      }
    }
    
    // 最后的默认情况
    console.log('未能明确检测语言，使用默认语言:', DEFAULT_LANGUAGE);
    return DEFAULT_LANGUAGE;
  } catch (error) {
    console.error('语言检测出错:', error);
    return DEFAULT_LANGUAGE;
  }
}

// 当前语言
const currentLocale = getSystemLocale();
console.log('初始化时检测到的系统语言:', currentLocale);
let currentLanguage = SUPPORTED_LANGUAGES.includes(currentLocale) ? 
  currentLocale : DEFAULT_LANGUAGE;
console.log('初始化时设置的应用语言:', currentLanguage);

// 更新语言设置 - 检测系统语言变化
function updateLanguage() {
  try {
    const prevLanguage = currentLanguage;
    // 强制使用ja-JP进行测试
    currentLanguage = 'ja-JP';
    console.log(`强制设置应用语言为日语`);
    return currentLanguage;
  } catch (error) {
    console.error('更新语言设置出错:', error);
    return currentLanguage;
  }
}

// 获取当前语言的配置数据
function getLanguageData() {
  updateLanguage(); // 每次获取语言数据时检查系统语言是否已变化
  return currentLanguage;
}

// 获取翻译文本
function __(key, params = {}) {
  // 每次调用时强制检查系统语言是否变化
  const lang = updateLanguage();
  console.log(`调用__('${key}')使用的语言: ${lang}`);
  
  // 获取当前语言的翻译
  const langData = translations[lang] || translations[DEFAULT_LANGUAGE];
  
  // 获取翻译文本
  let text = langData[key] || key;
  
  // 替换参数
  if (params && Object.keys(params).length > 0) {
    Object.keys(params).forEach(paramKey => {
      text = text.replace(`{${paramKey}}`, params[paramKey]);
    });
  }
  
  return text;
}

// 设置语言（可选，用于手动切换语言）
function setLanguage(lang) {
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    currentLanguage = lang;
    return true;
  }
  return false;
}

// 获取所有支持的语言
function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

module.exports = {
  __,
  getLanguageData,
  setLanguage,
  getSupportedLanguages,
  updateLanguage
}; 