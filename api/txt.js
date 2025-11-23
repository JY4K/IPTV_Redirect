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

    let txtOutput = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 保持分组行原样输出
      if (trimmedLine.includes('#genre#')) {
        txtOutput += `${trimmedLine}\n`;
        continue;
      }

      const parts = trimmedLine.split(',');
      if (parts.length < 2) continue;

      const name = parts[0].trim();
      // 提取 ID (与 iptv.js 逻辑一致)
      const id = name.split(' ')[0];
      
      // 生成 Vercel 中转链接
      const proxyUrl = `${baseUrl}/iptv.php?id=${encodeURIComponent(id)}`;

      txtOutput += `${name},${proxyUrl}\n`;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(txtOutput);

  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating TXT playlist');
  }
}