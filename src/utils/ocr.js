const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

/**
 * 对图像进行OCR识别
 * @param {string} imagePath - 图像文件路径
 * @param {string} language - 语言代码，例如 'chi_sim+eng', 'jpn', 'jpn+eng'
 * @returns {Promise<object>} OCR识别结果
 */
async function performOCR(imagePath, language = 'chi_sim+eng') {
  console.log('开始OCR识别，使用Tesseract.js 6.0');
  console.log('图像路径:', imagePath);
  console.log('识别语言:', language);
  
  // 检查是否包含日语
  const containsJapanese = language.includes('jpn');
  
  try {
    // 运行时导入electron模块
    const { app } = require('electron');
    
    // 确定训练数据文件的正确路径
    let resourcePath;
    
    if (app.isPackaged) {
      // 打包环境下，资源在resources目录
      resourcePath = process.resourcesPath;
    } else {
      // 开发环境下，资源在项目根目录
      resourcePath = process.cwd();
    }
    
    console.log('训练数据资源路径:', resourcePath);
    
    // 检查训练数据文件是否存在，并记录
    const langCodes = language.split('+');
    const missingLangs = [];
    
    langCodes.forEach(lang => {
      const dataPath = path.join(resourcePath, `${lang}.traineddata`);
      const exists = fs.existsSync(dataPath);
      console.log(`检查训练数据: ${dataPath}, 存在: ${exists}`);
      
      if (!exists) {
        missingLangs.push(lang);
      }
    });
    
    if (missingLangs.length > 0) {
      console.warn(`警告: 以下语言的训练数据文件未找到: ${missingLangs.join(', ')}`);
    }
    
    // Tesseract.js 6.0 的初始化方式
    try {
      console.log('尝试使用resourcePath中的训练数据');
      const worker = await createWorker(language, {
        langPath: resourcePath,
        // 修复日语支持，添加更多Tesseract配置
        ...(containsJapanese ? {
          tessjs_create_pdf: '0',  // 不创建PDF
          preserve_interword_spaces: '1',  // 保留单词间空格
          language_model_penalty_non_freq_dict_word: '0.8',  // 调整非常用词惩罚
          language_model_penalty_non_dict_word: '0.8',  // 调整非词典词惩罚
          textord_heavy_nr: '1', // 增强日语文本识别
          tessedit_pageseg_mode: '6' // 使用假设为单一均匀文本块的分割模式
        } : {})
      });
      
      return await processOcrWithWorker(worker, imagePath, containsJapanese);
    } catch (langPathError) {
      console.error('使用指定路径加载训练数据失败, 尝试默认路径:', langPathError);
      
      try {
        // 尝试使用默认路径
        console.log('尝试使用默认路径加载训练数据');
        const worker = await createWorker(language);
        return await processOcrWithWorker(worker, imagePath, containsJapanese);
      } catch (defaultPathError) {
        console.error('使用默认路径也失败:', defaultPathError);
        throw defaultPathError;
      }
    }
  } catch (error) {
    console.error('OCR处理出错:', error);
    throw error;
  }
}

// 处理OCR识别的辅助函数
async function processOcrWithWorker(worker, imagePath, containsJapanese) {
  try {
    // 设置识别参数，日语需要特殊处理
    if (containsJapanese) {
      console.log('使用日语优化设置');
      await worker.setParameters({
        tessjs_create_pdf: '0',  // 不创建PDF
        preserve_interword_spaces: '1',  // 保留单词间空格
        language_model_penalty_non_freq_dict_word: '0.8',  // 调整非常用词惩罚
        language_model_penalty_non_dict_word: '0.8',  // 调整非词典词惩罚
        textord_heavy_nr: '1', // 增强日语文本识别
        tessedit_pageseg_mode: '6' // 使用假设为单一均匀文本块的分割模式
      });
    }
    
    // 识别图像
    const result = await worker.recognize(imagePath);
    
    console.log('OCR识别完成, 文本长度:', result.data.text.length);
    
    // 清理Worker
    await worker.terminate();
    
    // 清理临时图像文件
    if (fs.existsSync(imagePath)) {
      console.log('清理临时图像文件');
      fs.unlinkSync(imagePath);
    }
    
    return result;
  } catch (error) {
    // 确保在出错情况下也能清理worker
    try {
      await worker.terminate();
    } catch (e) {
      console.error('终止worker时出错:', e);
    }
    throw error;
  }
}

module.exports = {
  performOCR
}; 