const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 具体的坏链接列表 (精准匹配)
// 你可以在这里添加更多已知的失效/错误提示视频链接
const SPECIFIC_BAD_URLS = [
  "https://txmov2.a.kwimgs.com/upic/2025/08/11/15/BMjAyNTA4MTExNTI0MjBfMjY4MzQ1Mjg4OV8xNzIwNDUyMzU2MzhfMl8z_b_B140a6e3a73034c8b53b0b99e67d1f2dd.mp4?tag=1-1763098524-std-1-m282ipsewh-578ac553019385a5&clientCacheKey=3xs2ccrqqdgzvgq_b.mp4&tt=b&di=739f67b1&bp=12681&ali_redirect_ex_hot=66666800&ali_redirect_ex_beacon=1",
  "https://txmov2.a.kwimgs.com/upic/2025/08/03/06/BMjAyNTA4MDMwNjIxMDVfMjY4MzQ1Mjg4OV8xNzEyNDQ4ODgwOTlfMl8z_b_Babfbf141decd9c1b20ce0ed917ba77ba.mp4?tag=1-1754173291-std-1-tk03vcvs6f-3820cce10c34ddb3&clientCacheKey=3xmhdmy63kva6bw_b.mp4&tt=b&di=88ccff4&bp=12681&ali_redirect_ex_hot=66666800&ali_redirect_ex_beacon=1"
];

// 模糊匹配特征 (保留作为辅助)
const BAD_URL_KEYWORDS = [
  'ali_redirect_ex_hot=',
  'clientCacheKey='
];

// 加载频道数据
function loadChannels() {
  // 假设 channels.json 位于根目录下的 data 文件夹
  const jsonPath = path.join(process.cwd(), 'data', 'channels.json');
  try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading channels.json:", e.message);
    return [];
  }
}

// 检测 URL 是否为坏链接
function isBadUrl(url) {
  if (!url) return true;
  
  // 1. 检查是否在精确黑名单中
  if (SPECIFIC_BAD_URLS.includes(url)) {
    return true;
  }

  // 2. 检查模糊特征 (可选，如果不想误杀可以注释掉这部分，仅保留上面精确匹配)
  // for (const keyword of BAD_URL_KEYWORDS) {
  //   if (url.includes(keyword)) return true;
  // }

  return false;
}

// 检测单个 URL 的有效性
async function checkUrl(url) {
  try {
    const start = Date.now();
    // 使用 HEAD 请求获取最终地址，不下载内容
    const response = await axios.head(url, {
      timeout: 3500, // 稍微放宽超时时间
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });

    const finalUrl = response.request.res.responseUrl || url;
    
    // 检查最终地址是否是坏链接
    if (isBadUrl(finalUrl)) {
      console.log(`Detected BAD URL: ${finalUrl}`);
      return { url: finalUrl, valid: false, time: 99999, error: 'Bad Redirect Target' };
    }

    return { 
      url: finalUrl, 
      valid: true, 
      time: Date.now() - start 
    };

  } catch (error) {
    // 如果 HEAD 被拒绝 (405)，尝试 GET
    if (error.response && error.response.status === 405) {
       try {
          const start = Date.now();
          const response = await axios.get(url, {
            headers: { Range: 'bytes=0-100' }, // 只读前100字节
            timeout: 3500,
            validateStatus: (status) => status >= 200 && status < 400
          });
          const finalUrl = response.request.res.responseUrl || url;
          
          if (isBadUrl(finalUrl)) {
            return { url: finalUrl, valid: false, time: 99999, error: 'Bad Redirect Target' };
          }

          return { url: finalUrl, valid: true, time: Date.now() - start };
       } catch (e) {
          return { url, valid: false, time: 99999 };
       }
    }
    return { url, valid: false, time: 99999, error: error.message };
  }
}

export default async function handler(req, res) {
  const { id } = req.query;

  // 获取当前域名，用于构建本地文件链接
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  // 按照要求，兜底视频位于 ./data/测试卡.mp4
  const fallbackUrl = `${baseUrl}/data/测试卡.mp4`;

  if (!id) {
    return res.status(400).send('Missing ID parameter');
  }

  const channelsData = loadChannels();
  let targetChannel = null;

  for (const group of channelsData) {
    const found = group.channels.find(c => c.id === id);
    if (found) {
      targetChannel = found;
      break;
    }
  }

  if (!targetChannel) {
    return res.redirect(302, fallbackUrl);
  }

  // IP授权逻辑：直接返回，不检测
  if (targetChannel.name === 'IP授权') {
    const directUrl = Array.isArray(targetChannel.url) ? targetChannel.url[0] : targetChannel.url;
    return res.redirect(302, directUrl);
  }

  let urls = [];
  if (Array.isArray(targetChannel.url)) {
    urls = targetChannel.url;
  } else if (typeof targetChannel.url === 'string') {
    urls = [targetChannel.url];
  }

  if (urls.length === 0) {
    return res.redirect(302, fallbackUrl);
  }

  try {
    // 并发检测
    const results = await Promise.all(urls.map(u => checkUrl(u)));
    const validResults = results.filter(r => r.valid);

    if (validResults.length > 0) {
      // 排序取最快
      validResults.sort((a, b) => a.time - b.time);
      return res.redirect(302, validResults[0].url);
    } else {
      // 所有链接都失效或都是坏链接 -> 跳转测试卡
      return res.redirect(302, fallbackUrl);
    }

  } catch (error) {
    console.error("System Error:", error);
    return res.redirect(302, fallbackUrl);
  }
}
