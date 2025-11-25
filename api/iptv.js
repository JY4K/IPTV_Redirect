const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 坏链接黑名单 (精确匹配快手系失效视频)
const BAD_URLS = [
  "https://txmov2.a.kwimgs.com/upic/2025/08/11/15/BMjAyNTA4MTExNTI0MjBfMjY4MzQ1Mjg4OV8xNzIwNDUyMzU2MzhfMl8z_b_B140a6e3a73034c8b53b0b99e67d1f2dd.mp4?tag=1-1763098524-std-1-m282ipsewh-578ac553019385a5&clientCacheKey=3xs2ccrqqdgzvgq_b.mp4&tt=b&di=739f67b1&bp=12681&ali_redirect_ex_hot=66666800&ali_redirect_ex_beacon=1",
  "https://txmov2.a.kwimgs.com/upic/2025/08/03/06/BMjAyNTA4MDMwNjIxMDVfMjY4MzQ1Mjg4OV8xNzEyNDQ4ODgwOTlfMl8z_b_Babfbf141decd9c1b20ce0ed917ba77ba.mp4?tag=1-1754173291-std-1-tk03vcvs6f-3820cce10c34ddb3&clientCacheKey=3xmhdmy63kva6bw_b.mp4&tt=b&di=88ccff4&bp=12681&ali_redirect_ex_hot=66666800&ali_redirect_ex_beacon=1"
];

const loadChannels = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'channels.json'), 'utf8'));
  } catch { return []; }
};

export default async function handler(req, res) {
  const { id } = req.query;
  // 兜底视频：依赖 public/data/测试卡.mp4
  // 注意：Vercel 部署后，静态资源路径直接是 /data/xxx，不需要 api 前缀
  const fallbackUrl = '/data/测试卡.mp4'; 

  if (!id) return res.redirect(302, fallbackUrl);

  const channels = loadChannels();
  // 查找频道
  let channel = null;
  for (const group of channels) {
    channel = group.channels.find(c => c.id === id);
    if (channel) break;
  }

  // 1. 频道不存在 -> 兜底
  if (!channel) return res.redirect(302, fallbackUrl);

  // 2. IP授权 -> 直接重定向，不检测
  if (channel.name === 'IP授权') {
    const url = Array.isArray(channel.url) ? channel.url[0] : channel.url;
    // 如果 url 存在则跳转，不存在则兜底
    return res.redirect(302, url || fallbackUrl);
  }

  // 3. 普通频道 -> 顺序检测
  let urls = Array.isArray(channel.url) ? channel.url : [channel.url];
  urls = urls.filter(u => u && u.trim() !== ''); // 过滤空值

  // 模拟浏览器的 User-Agent，防止部分服务器拦截 Vercel 请求
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  for (const url of urls) {
    try {
      // 这里的检测仅仅是为了看它是否会跳到“坏视频”
      const response = await axios.head(url, {
        headers,
        timeout: 2500, // 2.5秒超时
        maxRedirects: 3, // 跟随重定向以捕获最终地址
        validateStatus: s => s >= 200 && s < 400
      });

      // 获取重定向后的最终地址，用于比对坏链接
      const finalUrl = response.request.res.responseUrl || url;

      // 如果最终地址不在黑名单里，说明这个源是好的
      if (!BAD_URLS.includes(finalUrl)) {
        // [关键修复]：这里重定向回【原始 URL】(url)，而不是 finalUrl
        // 这样可以让客户端自己去请求 PHP 接口获取最新的 Token
        return res.redirect(302, url);
      } else {
        // 命中了坏链接，打印日志并继续检测下一个
        console.log(`Skipping bad URL: ${url} -> ${finalUrl}`);
      }
    } catch (e) {
      // 请求出错（超时或无法连接），继续下一个
      continue;
    }
  }

  // 4. 所有链接都检测失败 -> 兜底
  return res.redirect(302, fallbackUrl);
}
