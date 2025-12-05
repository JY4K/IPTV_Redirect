/**
 * 构建完整的Logo URL
 * @param {string} logo - Logo路径或完整URL
 * @returns {string} 完整的Logo URL
 */
function buildLogoUrl(logo) {
  // 如果是完整URL，直接返回
  if (logo.startsWith('http://') || logo.startsWith('https://')) {
    return logo;
  }
  
  // 其他情况使用外部URL拼接逻辑
  return `https://fy.188766.xyz/logo/fanmingming/live/tv/${encodeURIComponent(logo)}.png`;
}

/**
 * 构建频道播放URL
 * @param {string} baseUrl - 部署基础URL
 * @param {Object} channel - 频道信息对象
 * @returns {string} 完整的播放URL
 */
function buildChannelUrl(baseUrl, channel) {
  const isIpAuthChannel = channel.id === 'ipsq';
  const channelUrl = Array.isArray(channel.url) ? channel.url[0] : channel.url;
  return isIpAuthChannel ? channelUrl : `${baseUrl}/iptv.php?id=${channel.id}`;
}

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
        const { name, id, logo } = channel;
        
        const logoUrl = buildLogoUrl(logo);
        const channelUrl = buildChannelUrl(baseUrl, channel);

        // 拼接单行信息
        m3uOutput += `#EXTINF:-1 tvg-name="${name}" tvg-logo="${logoUrl}" group-title="${group.group}",${name}\n`;
        m3uOutput += `${channelUrl}\n`;
      }
      
      // 格式优化：分组结束后添加空行
      m3uOutput += '\n';
    }

    // 5. 返回响应
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.status(200).send(m3uOutput);

  } catch (error) {
    console.error('Failed to generate M3U:', error);
    res.status(500).send('Internal Server Error: Failed to generate M3U');
  }
}
