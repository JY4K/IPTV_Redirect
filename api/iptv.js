const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 读取数据
const loadChannels = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'channels.json'), 'utf8'));
  } catch { return []; }
};

export default async function handler(req, res) {
  const { id } = req.query;
  const fallbackUrl = '/data/测试卡.mp4'; // 兜底

  if (!id) return res.redirect(302, fallbackUrl);

  const channels = loadChannels();
  let channel = null;

  // 1. 查找频道
  for (const group of channels) {
    channel = group.channels.find(c => c.id === id);
    if (channel) break;
  }

  if (!channel) return res.redirect(302, fallbackUrl);

  // 2. 准备 URL 列表
  let urls = Array.isArray(channel.url) ? channel.url : [channel.url];
  urls = urls.filter(u => u && u.trim() !== '');

  // 3. 特殊处理：IP授权 或 列表为空 -> 直接跳转第一个，不检测
  if (channel.name === 'IP授权' || urls.length === 0) {
    return res.redirect(302, urls[0] || fallbackUrl);
  }

  // 4. 顺序检测
  for (const url of urls) {
    try {
      // 仅发送 HEAD 请求检测是否通畅，超时 1.5秒
      await axios.head(url, {
        timeout: 1500,
        validateStatus: status => status >= 200 && status < 400 // 只要状态码正常就认为可用
      });

      // [核心] 检测成功，直接重定向到【原始 URL】
      return res.redirect(302, url);

    } catch (e) {
      // 连接超时或报错，尝试下一个
      continue;
    }
  }

  // 5. 全部失败 -> 兜底
  return res.redirect(302, fallbackUrl);
}
