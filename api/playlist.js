const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const { type } = req.query;
  const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  const iptvUrl = `${baseUrl}/iptv.php?id=`;
  
  let data = [];
  try {
    const jsonPath = path.join(process.cwd(), 'data', 'channels.json');
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error("Error reading channels in playlist:", e.message);
  }

  if (type === 'm3u') {
    let content = '#EXTM3U x-tvg-url="https://fy.188766.xyz/e.xml"\n';
    
    if (data && Array.isArray(data)) {
      data.forEach(group => {
        if (group.channels) {
          group.channels.forEach(c => {
            let logo = c.logo || '';
            if (logo.startsWith('./')) {
              logo = `${baseUrl}${logo.substring(1)}`;
            } else if (logo && !logo.startsWith('http')) {
              logo = `https://fy.188766.xyz/logo/fanmingming/live/tv/${logo}.png`;
            }
            content += `#EXTINF:-1 tvg-name="${c.name}" tvg-logo="${logo}" group-title="${group.group}",${c.name}\n${iptvUrl}${c.id}\n`;
          });
        }
      });
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.send(content);
  } 
  else if (type === 'txt') {
    let content = '';
    if (data && Array.isArray(data)) {
      data.forEach((group, i) => {
        content += `${group.group},#genre#\n`;
        if (group.channels) {
          group.channels.forEach(c => {
            content += `${c.name},${iptvUrl}${c.id}\n`;
          });
        }
        if (i < data.length - 1) content += '\n';
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } else {
    res.status(400).send('Invalid type');
  }
};
