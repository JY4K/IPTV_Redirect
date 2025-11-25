const fs = require('fs');
const path = require('path');

export default function handler(req, res) {
  const { type } = req.query;
  // 获取当前域名
  const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  const iptvUrl = `${baseUrl}/iptv.php?id=`;
  
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'channels.json'), 'utf8'));
  } catch { }

  if (type === 'm3u') {
    let content = '#EXTM3U x-tvg-url="https://fy.188766.xyz/e.xml"\n';
    
    data.forEach(group => {
      group.channels.forEach(c => {
        // Logo 拼接逻辑
        let logo = c.logo || '';
        if (logo.startsWith('./')) {
          // 本地 logo: ./data/xx -> https://domain/data/xx
          logo = `${baseUrl}${logo.substring(1)}`;
        } else if (logo && !logo.startsWith('http')) {
          // 只有名称 -> 拼接 fanmingming
          logo = `https://fy.188766.xyz/logo/fanmingming/live/tv/${logo}.png`;
        }
        
        content += `#EXTINF:-1 tvg-name="${c.name}" tvg-logo="${logo}" group-title="${group.group}",${c.name}\n${iptvUrl}${c.id}\n`;
      });
    });

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.send(content);
  } 
  else if (type === 'txt') {
    let content = '';
    data.forEach((group, i) => {
      content += `${group.group},#genre#\n`;
      group.channels.forEach(c => {
        content += `${c.name},${iptvUrl}${c.id}\n`;
      });
      // 组之间加空行
      if (i < data.length - 1) content += '\n';
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } else {
    res.status(400).send('Invalid type');
  }
}
