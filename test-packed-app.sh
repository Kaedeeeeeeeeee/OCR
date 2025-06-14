#!/bin/bash

# 杀死所有可能正在运行的Electron进程
echo "杀死所有可能在运行的Electron/QuickOCR进程..."
pkill -f Electron || true
pkill -f QuickOCR || true
sleep 1

# 清除之前的构建
echo "清除之前的构建..."
rm -rf dist

# 使用调试配置打包应用
echo "打包应用..."
npm run dist:debug

# 检查打包是否成功
if [ $? -ne 0 ]; then
  echo "打包失败！"
  exit 1
fi

echo "打包完成，启动应用..."

# 清除旧日志
rm -f ~/Library/Application\ Support/quick-ocr/app.log
rm -f ~/Library/Application\ Support/quick-ocr/error.log

# 启动应用
if [ -d "dist/mac-arm64" ]; then
  ./dist/mac-arm64/QuickOCR.app/Contents/MacOS/QuickOCR &
elif [ -d "dist/mac" ]; then
  ./dist/mac/QuickOCR.app/Contents/MacOS/QuickOCR &
else
  echo "找不到打包后的应用！"
  exit 1
fi

# 等待几秒钟让应用初始化
sleep 3

# 显示日志
echo ""
echo "应用日志："
cat ~/Library/Application\ Support/quick-ocr/app.log

echo ""
echo "错误日志："
if [ -f ~/Library/Application\ Support/quick-ocr/error.log ]; then
  cat ~/Library/Application\ Support/quick-ocr/error.log
else
  echo "无错误日志文件"
fi

# 提示
echo ""
echo "应用应该在状态栏中显示图标。如果没有，可能存在问题。"
echo "按Ctrl+C结束此脚本。"

# 持续显示新的日志条目
echo ""
echo "持续监视日志更新："
tail -f ~/Library/Application\ Support/quick-ocr/app.log 