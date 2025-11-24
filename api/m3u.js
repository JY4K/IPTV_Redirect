const fs = require('fs');
const path = require('path');

export default function handler(req, res) {
  try {
    // 1. 读取数据
    const filePath = path.join(process.cwd(), 'data', 'channels.json');
    const groups = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // 2. 获取部署域名
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    const baseUrl = `${protocol}://${host}`;

    // 3. 构建 M3U 头部
    let m3uOutput = '#EXTM3U x-tvg-url="https://fy.188766.xyz/e.xml"\n';

    // 4. 遍历生成
    for (const group of groups) {
      for (const channel of group.channels) {
        // 使用 JSON 中明确定义的 id 和 logo
        const { name, id, logo } = channel;
        
        // 拼接 Logo 地址
        // 检测logo字段是否已经是完整URL，如果是则直接使用，否则使用原来的拼接方式
        const isFullUrl = logo.startsWith('http://') || logo.startsWith('https://');
        const logoUrl = isFullUrl ? logo : `https://fy.188766.xyz/logo/fanmingming/live/tv/${encodeURIComponent(logo)}.png`;
        
        // 生成URL
        // 对于IP授权频道使用直连链接，其他频道使用中转地址
        const isIpAuthChannel = id === 'ipsq';
        const channelUrl = Array.isArray(channel.url) ? channel.url[0] : channel.url;
        const outputUrl = isIpAuthChannel ? channelUrl : `${baseUrl}/iptv.php?id=${id}`;

        // 拼接单行信息
        m3uOutput += `#EXTINF:-1 tvg-name="${name}" tvg-logo="${logoUrl}" group-title="${group.group}",${name}\n`;
        m3uOutput += `${outputUrl}\n`;
      }
      
      // === 格式优化：分组结束后添加空行 ===
      m3uOutput += '\n';
    }

    // 5. 返回响应
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.status(200).send(m3uOutput);

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error: Failed to generate M3U');
  }
}
