# QuickOCR - 即时文字识别工具

QuickOCR是一款跨平台的即时OCR软件，可运行在Mac和Windows系统上。它不会在桌面生成窗口，只会在状态栏/系统托盘中显示一个小图标，让您可以随时通过快捷键进行屏幕OCR文字识别。

## 功能特点

- 通过全局快捷键触发OCR功能（默认为`Shift+Command+E`，Windows上为`Shift+Ctrl+E`）
- 仅在状态栏/系统托盘显示图标，不占用桌面空间
- 支持自定义快捷键
- 支持多种语言识别（中文简体、繁体、英文、日文、韩文等）
- 自动将识别结果复制到剪贴板
- 识别完成后可选择是否显示通知
- 使用Tesseract.js引擎进行本地离线识别

## 安装方法

### 从发布版本安装

1. 前往[发布页面](https://github.com/yourname/quick-ocr/releases)下载最新版本
2. Mac用户：下载`.dmg`文件，打开并将应用拖到应用程序文件夹
3. Windows用户：下载`.exe`安装文件，双击运行安装

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yourname/quick-ocr.git
cd quick-ocr

# 安装依赖
npm install

# 运行应用
npm start

# 打包应用
npm run dist         # 为当前平台打包
npm run dist:mac     # 仅为Mac打包
npm run dist:win     # 仅为Windows打包
```

## 使用方法

1. 启动应用后，它会在状态栏/系统托盘中显示一个图标
2. 使用默认快捷键`Shift+Command+E`(Mac)或`Shift+Ctrl+E`(Windows)触发OCR
3. OCR完成后，结果会自动复制到剪贴板
4. 点击状态栏/系统托盘图标可以查看设置、关于或退出应用

## 权限需求

- **屏幕录制权限**：首次使用时，应用会请求屏幕录制权限，这是捕获屏幕进行OCR所必需的
- **辅助功能权限**（仅Mac）：若要使用全局快捷键，可能需要授予辅助功能权限

## 技术栈

- Electron：跨平台桌面应用框架
- Tesseract.js：OCR文字识别库
- Sharp：图像处理库

## OCR引擎

### Tesseract.js

- 优点：完全本地运行，无需网络，无需API密钥，无使用限制
- 特点：识别速度适中，支持多种语言，无需联网即可使用

## 语言支持

Tesseract.js支持的主要语言：
- 简体中文 (chi_sim)
- 繁体中文 (chi_tra)
- 英文 (eng)
- 日文 (jpn)
- 韩文 (kor)
- 更多语言...

## 隐私说明

所有OCR处理在本地完成，不会发送任何数据到外部服务器，保护您的隐私安全。

## 许可证

MIT # OCR
