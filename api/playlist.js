const fs = require('fs');
const path = require('path');

export default function handler(req, res) {
  const { type } = req.query;
  const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  const iptvUrl = `${baseUrl}/iptv.php?id=`;
  
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'channels.json'), 'utf8'));
  } catch { }

  if (type === 'm3u') {
    // 固定头部
    let content = '#EXTM3U x-tvg-url="https://fy.188766.xyz/e.xml"\n';
    
    data.forEach(group => {
      group.channels.forEach(c => {
        // Logo 处理逻辑
        let logo = c.logo || '';
        if (logo.startsWith('./')) {
          // 如果是本地路径 ./data/xxx -> 转换为 https://domain/data/xxx
          logo = `${baseUrl}${logo.substring(1)}`;
        } else if (logo && !logo.startsWith('http')) {
          // 如果只有文件名 -> 拼接 fanmingming 库
          logo = `https://fy.188766.xyz/logo/fanmingming/live/tv/${logo}.png`;
        }
        
        // 拼接 M3U 条目
        content += `#EXTINF:-1 tvg-name="${c.name}" tvg-logo="${logo}" group-title="${group.group}",${c.name}\n${iptvUrl}${c.id}\n`;
      });
    });

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.send(content);
  } 
  else if (type === 'txt') {
    let content = '';
    data.forEach((group, i) => {
      // 写入组名
      content += `${group.group},#genre#\n`;
      // 写入频道
      group.channels.forEach(c => {
        content += `${c.name},${iptvUrl}${c.id}\n`;
      });
      // 组之间空一行
      if (i < data.length - 1) content += '\n';
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } else {
    res.status(400).send('Invalid type');
  }
}
