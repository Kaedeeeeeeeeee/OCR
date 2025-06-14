#!/bin/bash

# 清除旧日志
rm -f ~/Library/Application\ Support/quick-ocr/app.log
rm -f ~/Library/Application\ Support/quick-ocr/error.log

# 从命令行启动应用
echo "启动QuickOCR应用..."
./dist/mac-arm64/QuickOCR.app/Contents/MacOS/QuickOCR &

# 等待几秒钟让应用初始化
sleep 3

# 显示日志
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