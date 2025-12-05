const fs = require('fs');
const path = require('path');

// 缓存 JSON 数据，减少重复读取
let cachedData = null;

/**
 * 获取频道列表数据（带缓存）
 * @returns {Array} 频道分组列表
 */
function getChannels() {
  if (cachedData) return cachedData;
  try {
    const filePath = path.join(process.cwd(), 'data', 'channels.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    cachedData = JSON.parse(fileContent);
    return cachedData;
  } catch (e) {
    console.error("Failed to load channels.json:", e);
    return [];
  }
}

/**
 * 检测单个 URL 是否可用并记录响应时间
 * @param {string} url - 要检测的URL
 * @returns {Promise<Object>} 包含URL和响应时间的对象
 */
async function checkUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
  const startTime = Date.now();

  try {
    // 使用GET请求而不是HEAD请求，更准确地检测视频URL可用性
    const response = await fetch(url, { 
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Range': 'bytes=0-1023' // 只请求前1KB数据，减少带宽消耗
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    // 检查响应状态码
    if (response.ok || response.status === 206) { // 206表示部分内容请求成功
      // 读取一小部分响应数据以确保连接有效
      // 使用arrayBuffer避免文本解码错误
      await response.arrayBuffer();
      return { url, responseTime };
    } else {
      throw new Error(`Status ${response.status}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 发送兜底视频
 * @param {Object} res - HTTP响应对象
 * @param {string} channelId - 频道ID
 */
async function sendBackupVideo(res, channelId) {
  const backupVideoPath = path.join(process.cwd(), 'public', '测试卡.mp4');
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(backupVideoPath)) {
      throw new Error('Backup video file not found');
    }
    
    // 设置正确的Content-Type
    res.setHeader('Content-Type', 'video/mp4');
    
    // 使用fs.createReadStream来流式传输视频文件
    const videoStream = fs.createReadStream(backupVideoPath);
    videoStream.pipe(res);
    
    // 处理流错误
    videoStream.on('error', (error) => {
      console.error(`Backup video stream error for ${channelId}:`, error);
      if (!res.headersSent) {
        res.status(500).send('Error: Backup video streaming failed.');
      }
    });
    
  } catch (error) {
    console.error(`Failed to serve backup video for ${channelId}:`, error);
    
    // 确保只发送一次响应
    if (!res.headersSent) {
      res.status(500).send('Error: Failed to load backup video.');
    }
  }
}

export default async function handler(req, res) {
  const { id } = req.query;

  // 参数验证
  if (!id) {
    return res.status(400).send('Error: Missing "id" parameter.');
  }

  const groups = getChannels();

  // 1. 查找频道
  let targetChannel = null;
  for (const group of groups) {
    const channel = group.channels.find(c => c.id === id);
    if (channel) {
      targetChannel = channel;
      break;
    }
  }

  if (!targetChannel) {
    return res.status(404).send(`Error: Channel ID "${id}" not found.`);
  }

  // 2. 处理 URL
  const urls = Array.isArray(targetChannel.url) ? targetChannel.url : [targetChannel.url];
  
  // 对于IP授权频道，直接返回URL而不进行重定向
  if (targetChannel.id === 'ipsq') {
    return res.status(200).send(`URL: ${urls[0]}`);
  }

  // 情况 A: 只有一个 URL，先检测可用性再跳转
  if (urls.length === 1) {
    try {
      await checkUrl(urls[0]);
      // 检测通过，重定向到该URL
      return res.redirect(302, urls[0]);
    } catch (error) {
      // 检测失败，返回兜底视频
      console.warn(`Single URL failed for channel ${id}, falling back to backup video:`, error.message);
      await sendBackupVideo(res, id);
      return;
    }
  }

  // 情况 B: 多个 URL，并发检测，选择最快的可用链接
  try {
    // 构造检测队列
    const checkPromises = urls.map(url => checkUrl(url));
    
    // 获取所有成功的结果
    const results = await Promise.allSettled(checkPromises);
    const successfulResults = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    // 如果有成功的结果，选择响应时间最快的
    if (successfulResults.length > 0) {
      // 按响应时间排序，选择最快的
      const fastestResult = successfulResults.reduce((fastest, current) => {
        return current.responseTime < fastest.responseTime ? current : fastest;
      });
      
      console.log(`Channel ${id}: Selected fastest URL (${fastestResult.responseTime}ms): ${fastestResult.url}`);
      return res.redirect(302, fastestResult.url);
    } else {
      // 所有检测都失败
      throw new AggregateError('All URLs failed to respond');
    }
  } catch (error) {
    // 情况 C: 所有检测都失败
    console.warn(`All sources failed for channel ${id}, falling back to backup video.`);
    
    // 降级策略：返回兜底视频
    await sendBackupVideo(res, id);
    return;
  }
}