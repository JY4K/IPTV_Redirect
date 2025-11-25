const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 读取数据
const loadChannels = () => {
  try {
    // Vercel 运行时 process.cwd() 通常是根目录
    const jsonPath = path.join(process.cwd(), 'data', 'channels.json');
    const fileContent = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (e) {
    console.error("Error loading channels.json:", e.message);
    return [];
  }
};

// 使用 CommonJS 导出，防止语法报错
module.exports = async (req, res) => {
  const { id } = req.query;
  const fallbackUrl = '/data/测试卡.mp4'; 

  // 1. 基础检查
  if (!id) return res.redirect(302, fallbackUrl);

  const channels = loadChannels();
  if (!channels || channels.length === 0) {
    console.error("Channels list is empty or file not found.");
    return res.redirect(302, fallbackUrl);
  }

  // 2. 查找频道
  let channel = null;
  for (const group of channels) {
    if (group.channels) {
      channel = group.channels.find(c => c.id === id);
      if (channel) break;
    }
  }

  if (!channel) {
    console.log(`Channel ID ${id} not found.`);
    return res.redirect(302, fallbackUrl);
  }

  // 3. 准备 URL
  let urls = Array.isArray(channel.url) ? channel.url : [channel.url];
  urls = urls.filter(u => u && u.trim() !== '');

  // 4. IP授权或空链接 -> 直接跳转
  if (channel.name === 'IP授权' || urls.length === 0) {
    return res.redirect(302, urls[0] || fallbackUrl);
  }

  // 5. 顺序检测
  for (const url of urls) {
    try {
      // 仅检测是否通畅
      await axios.head(url, {
        timeout: 1500,
        validateStatus: status => status >= 200 && status < 400
      });
      // 成功 -> 重定向到原始链接
      return res.redirect(302, url);
    } catch (e) {
      // 失败 -> 继续下一个
      continue;
    }
  }

  // 6. 全部失败 -> 兜底
  return res.redirect(302, fallbackUrl);
};
