const { desktopCapturer, screen, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 临时存储选择区域窗口
let selectionWindow = null;

/**
 * 捕获屏幕并返回图像路径
 * @returns {Promise<string>} 返回截图文件路径
 */
async function captureScreen() {
  try {
    console.log('开始屏幕捕获过程');
    // 获取主显示器
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    console.log(`主显示器尺寸: ${width}x${height}`);
    
    // 获取所有可用的桌面捕获源
    console.log('获取桌面捕获源');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });
    
    // 找到主显示器对应的源
    const mainSource = sources.find(source => source.display_id === primaryDisplay.id.toString()) || sources[0];
    
    if (!mainSource) {
      throw new Error('无法捕获屏幕');
    }
    
    console.log('获取到屏幕捕获源:', mainSource.id);
    
    // 获取完整屏幕截图
    const fullScreenThumbnail = mainSource.thumbnail.toPNG();
    
    // 确保临时目录存在
    const tempDir = path.join(os.tmpdir(), 'quick-ocr');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // 保存完整屏幕截图到临时文件
    const timestamp = new Date().getTime();
    const fullScreenPath = path.join(tempDir, `screenshot-full-${timestamp}.png`);
    fs.writeFileSync(fullScreenPath, fullScreenThumbnail);
    console.log('完整屏幕截图已保存:', fullScreenPath);
    
    // 使用选择区域窗口让用户选择OCR区域
    const selectedRegion = await showSelectionWindow(fullScreenPath);
    console.log('用户选择了区域:', selectedRegion);
    
    if (!selectedRegion) {
      console.log('用户取消了选择');
      return null;
    }
    
    // 生成最终的截图文件路径
    const finalImagePath = path.join(tempDir, `screenshot-region-${timestamp}.png`);
    
    // 使用sharp库裁剪图像
    try {
      console.log('开始裁剪选中区域');
      const sharp = require('sharp');
      await sharp(fullScreenPath)
        .extract({
          left: selectedRegion.x,
          top: selectedRegion.y,
          width: selectedRegion.width,
          height: selectedRegion.height
        })
        .toFile(finalImagePath);
      
      console.log('区域裁剪成功，保存到:', finalImagePath);
      
      // 删除全屏截图，节省空间
      fs.unlinkSync(fullScreenPath);
      
      return finalImagePath;
    } catch (error) {
      console.error('裁剪图像失败:', error);
      // 如果裁剪失败，退回到使用完整截图
      console.log('退回到使用完整截图');
      return fullScreenPath;
    }
  } catch (error) {
    console.error('屏幕捕获失败:', error);
    throw error;
  }
}

/**
 * 显示选择区域窗口
 * @param {string} screenshotPath - 屏幕截图路径
 * @returns {Promise<{x: number, y: number, width: number, height: number} | null>} 选择的区域
 */
function showSelectionWindow(screenshotPath) {
  return new Promise((resolve) => {
    // 创建一个新的窗口，用于显示屏幕截图和选择区域
    selectionWindow = new BrowserWindow({
      fullscreen: true,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    // 加载HTML内容
    selectionWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: rgba(0, 0, 0, 0.3);
            user-select: none;
          }
          #background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url('file://${screenshotPath.replace(/\\/g, '\\\\')}');
            background-size: cover;
            opacity: 0.7;
          }
          #selection {
            position: absolute;
            border: 2px dashed rgba(255, 255, 255, 0.8);
            background-color: rgba(0, 120, 255, 0.2);
            display: none;
          }
          #instructions {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-family: Arial, sans-serif;
            font-size: 16px;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 10px 20px;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div id="background"></div>
        <div id="selection"></div>
        <div id="instructions">拖动鼠标选择要识别的区域，按ESC取消</div>
        <script>
          const background = document.getElementById('background');
          const selection = document.getElementById('selection');
          let startX, startY;
          let isSelecting = false;
          
          document.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            isSelecting = true;
            selection.style.left = startX + 'px';
            selection.style.top = startY + 'px';
            selection.style.width = '0px';
            selection.style.height = '0px';
            selection.style.display = 'block';
          });
          
          document.addEventListener('mousemove', (e) => {
            if (!isSelecting) return;
            
            const currentX = e.clientX;
            const currentY = e.clientY;
            
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            
            selection.style.left = Math.min(currentX, startX) + 'px';
            selection.style.top = Math.min(currentY, startY) + 'px';
            selection.style.width = width + 'px';
            selection.style.height = height + 'px';
          });
          
          document.addEventListener('mouseup', (e) => {
            if (!isSelecting) return;
            isSelecting = false;
            
            const endX = e.clientX;
            const endY = e.clientY;
            
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);
            
            // 区域太小则忽略
            if (width < 10 || height < 10) {
              selection.style.display = 'none';
              return;
            }
            
            window.electronAPI.selectionComplete({
              x,
              y, 
              width,
              height
            });
          });
          
          // 按ESC取消
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              window.electronAPI.selectionCanceled();
            }
          });
          
          // 绑定到window上的API
          window.electronAPI = {
            selectionComplete: (region) => {
              if (window.electronBridge && window.electronBridge.selectionComplete) {
                window.electronBridge.selectionComplete(region);
              } else {
                // 如果bridge未正常绑定，尝试使用IPC
                window.electronSelectionRegion = region;
                const event = new CustomEvent('selection-complete', { detail: region });
                document.dispatchEvent(event);
              }
            },
            selectionCanceled: () => {
              if (window.electronBridge && window.electronBridge.selectionCanceled) {
                window.electronBridge.selectionCanceled();
              } else {
                const event = new CustomEvent('selection-canceled');
                document.dispatchEvent(event);
              }
            }
          };
        </script>
      </body>
      </html>
    `);
    
    // 注册IPC处理器，用于接收选择结果
    const selectionCompleteHandler = (event, region) => {
      selectionWindow.close();
      selectionWindow = null;
      resolve(region);
    };
    
    const selectionCanceledHandler = () => {
      selectionWindow.close();
      selectionWindow = null;
      resolve(null);
    };
    
    ipcMain.once('selection-complete', selectionCompleteHandler);
    ipcMain.once('selection-canceled', selectionCanceledHandler);
    
    // 当窗口准备好后，设置一些IPC通信
    selectionWindow.webContents.on('did-finish-load', () => {
      selectionWindow.webContents.executeJavaScript(`
        window.electronBridge = {
          selectionComplete: (region) => {
            require('electron').ipcRenderer.send('selection-complete', region);
          },
          selectionCanceled: () => {
            require('electron').ipcRenderer.send('selection-canceled');
          }
        };
        
        // 如果已经通过DOM事件选择了区域，处理它
        document.addEventListener('selection-complete', (e) => {
          window.electronBridge.selectionComplete(e.detail);
        });
        
        document.addEventListener('selection-canceled', () => {
          window.electronBridge.selectionCanceled();
        });
        
        if (window.electronSelectionRegion) {
          window.electronBridge.selectionComplete(window.electronSelectionRegion);
        }
      `);
    });
    
    // 如果窗口被直接关闭
    selectionWindow.on('closed', () => {
      if (selectionWindow) {
        selectionWindow = null;
        resolve(null);
        ipcMain.removeListener('selection-complete', selectionCompleteHandler);
        ipcMain.removeListener('selection-canceled', selectionCanceledHandler);
      }
    });
  });
}

module.exports = {
  captureScreen
}; 