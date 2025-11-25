const fs = require('fs');
const path = require('path');

// 缓存 JSON 数据，减少重复读取
let cachedData = null;

function getChannels() {
  if (cachedData) return cachedData;
  try {
    const filePath = path.join(process.cwd(), 'data', 'channels.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    cachedData = JSON.parse(fileContent);
    return cachedData;
  } catch (e) {
    console.error("Failed to load channels.json", e);
    return [];
  }
}

// 辅助函数：检测单个 URL 是否可用（使用 HEAD 请求）
// 设置 3000ms 超时，避免 Vercel 函数运行过久
async function checkUrl(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

  try {
    const response = await fetch(url, { 
      method: 'HEAD', 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return url;
    } else {
      throw new Error(`Status ${response.status}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export default async function handler(req, res) {
  const { id } = req.query;

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
    // 直接返回第一个URL
    return res.status(200).send(`URL: ${urls[0]}`);
  }

  // 情况 A: 只有一个 URL，直接跳转，无需检测 (最快)
  if (urls.length === 1) {
    return res.redirect(302, urls[0]);
  }

  // 情况 B: 多个 URL，并发检测，谁快谁赢
  try {
    // 构造检测队列
    const checkPromises = urls.map(url => checkUrl(url));
    
    // Promise.any 返回第一个成功 (fulfilled) 的结果
    const fastestUrl = await Promise.any(checkPromises);
    
    // 重定向到最快的有效链接
    return res.redirect(302, fastestUrl);

  } catch (error) {
    // 情况 C: 所有检测都失败 (AggregateError)
    console.warn(`All sources failed for ${id}, falling back to first URL.`);
    
    // 降级策略：如果检测都挂了，还是跳转到第一个链接试试
    return res.redirect(302, urls[0]);
  }
}
