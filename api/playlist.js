const fs = require('fs');
const path = require('path');

function loadChannels() {
  const jsonPath = path.join(process.cwd(), 'data', 'channels.json');
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    return [];
  }
}

export default function handler(req, res) {
  const { type } = req.query;
  
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  const iptvBaseUrl = `${baseUrl}/iptv.php?id=`;

  const data = loadChannels();

  if (type === 'm3u') {
    let m3uContent = '#EXTM3U x-tvg-url="https://fy.188766.xyz/e.xml"\n';

    data.forEach(group => {
      group.channels.forEach(channel => {
        let logoUrl = '';
        if (channel.logo) {
          // 处理相对路径：将 ./data/logo/xxx.png 映射为 URL /data/logo/xxx.png
          if (channel.logo.startsWith('./')) {
            const cleanPath = channel.logo.replace('./', '/');
            logoUrl = `${baseUrl}${cleanPath}`;
          } else {
            logoUrl = `https://fy.188766.xyz/logo/fanmingming/live/tv/${channel.logo}.png`;
          }
        }

        m3uContent += `#EXTINF:-1 tvg-name="${channel.name}" tvg-logo="${logoUrl}" group-title="${group.group}",${channel.name}\n`;
        m3uContent += `${iptvBaseUrl}${channel.id}\n`;
      });
    });

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="ipv6.m3u"');
    return res.send(m3uContent);
  } 
  
  else if (type === 'txt') {
    let txtContent = '';

    data.forEach((group, index) => {
      txtContent += `${group.group},#genre#\n`;
      
      group.channels.forEach(channel => {
        txtContent += `${channel.name},${iptvBaseUrl}${channel.id}\n`;
      });

      if (index < data.length - 1) {
        txtContent += '\n';
      }
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(txtContent);
  }

  else {
    res.status(400).send('Invalid type');
  }
}
