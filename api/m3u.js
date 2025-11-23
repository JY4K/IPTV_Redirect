const fs = require('fs');
const path = require('path');

export default function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'data', 'playlist.txt');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    
    // 获取当前 Vercel 部署的域名
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    const baseUrl = `${protocol}://${host}`;

    let m3uOutput = '#EXTM3U x-tvg-url="https://fy.188766.xyz/e.xml"\n';
    let currentGroup = '未分类';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 处理分组行
      if (trimmedLine.includes('#genre#')) {
        currentGroup = trimmedLine.split(',')[0];
        continue;
      }

      const parts = trimmedLine.split(',');
      if (parts.length < 2) continue;

      const name = parts[0].trim();
      // 这里的 ID 生成逻辑必须与 iptv.js 保持一致
      // "CCTV1 综合" -> id="CCTV1"
      // "浙江卫视" -> id="浙江卫视"
      const id = name.split(' ')[0]; 
      
      // 生成 Logo URL (按照您的示例格式)
      const logoUrl = `https://fy.188766.xyz/logo/fanmingming/live/tv/${id}.png`;
      
      // 生成 Vercel 中转链接
      const proxyUrl = `${baseUrl}/iptv.php?id=${encodeURIComponent(id)}`;

      m3uOutput += `#EXTINF:-1 tvg-name="${name}" tvg-logo="${logoUrl}" group-title="${currentGroup}",${name}\n`;
      m3uOutput += `${proxyUrl}\n`;
    }

    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.status(200).send(m3uOutput);

  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating M3U playlist');
  }
}