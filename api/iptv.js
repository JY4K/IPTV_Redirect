const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 坏链接黑名单 (精确匹配)
const BAD_URLS = [
  "https://txmov2.a.kwimgs.com/upic/2025/08/11/15/BMjAyNTA4MTExNTI0MjBfMjY4MzQ1Mjg4OV8xNzIwNDUyMzU2MzhfMl8z_b_B140a6e3a73034c8b53b0b99e67d1f2dd.mp4?tag=1-1763098524-std-1-m282ipsewh-578ac553019385a5&clientCacheKey=3xs2ccrqqdgzvgq_b.mp4&tt=b&di=739f67b1&bp=12681&ali_redirect_ex_hot=66666800&ali_redirect_ex_beacon=1",
  "https://txmov2.a.kwimgs.com/upic/2025/08/03/06/BMjAyNTA4MDMwNjIxMDVfMjY4MzQ1Mjg4OV8xNzEyNDQ4ODgwOTlfMl8z_b_Babfbf141decd9c1b20ce0ed917ba77ba.mp4?tag=1-1754173291-std-1-tk03vcvs6f-3820cce10c34ddb3&clientCacheKey=3xmhdmy63kva6bw_b.mp4&tt=b&di=88ccff4&bp=12681&ali_redirect_ex_hot=66666800&ali_redirect_ex_beacon=1"
];

// 读取 channels.json (源数据文件仍放在根目录 data 下)
const loadChannels = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'channels.json'), 'utf8'));
  } catch { return []; }
};

export default async function handler(req, res) {
  const { id } = req.query;
  // 兜底链接 (依赖 public/data/测试卡.mp4)
  const fallbackUrl = '/data/测试卡.mp4'; 

  if (!id) return res.redirect(fallbackUrl);

  const channels = loadChannels();
  let channel = null;
  // 查找频道
  for (const group of channels) {
    channel = group.channels.find(c => c.id === id);
    if (channel) break;
  }

  // 1. 频道不存在 -> 兜底
  if (!channel) return res.redirect(fallbackUrl);

  // 2. IP授权 -> 直接重定向，不检测
  if (channel.name === 'IP授权') {
    const url = Array.isArray(channel.url) ? channel.url[0] : channel.url;
    return res.redirect(302, url || fallbackUrl);
  }

  // 3. 普通频道 -> 顺序检测
  let urls = Array.isArray(channel.url) ? channel.url : [channel.url];
  urls = urls.filter(u => u); // 过滤空值

  for (const url of urls) {
    try {
      // 仅请求头 (HEAD)，超时2秒，跟随重定向检测是否跳到了坏链接
      const response = await axios.head(url, {
        timeout: 2000,
        maxRedirects: 3,
        validateStatus: s => s >= 200 && s < 400
      });

      const finalUrl = response.request.res.responseUrl || url;

      // 检查是否命中黑名单
      if (!BAD_URLS.includes(finalUrl)) {
        // 成功！直接跳转并结束
        return res.redirect(302, finalUrl);
      }
    } catch (e) {
      // 当前链接检测失败，自动进入下一次循环检测下一个
      continue;
    }
  }

  // 4. 所有链接都挂了 -> 兜底
  return res.redirect(302, fallbackUrl);
}
