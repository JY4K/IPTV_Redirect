const fs = require('fs');
const path = require('path');

/**
 * 构建频道代理URL
 * @param {string} baseUrl - 部署基础URL
 * @param {Object} channel - 频道信息对象
 * @returns {string} 完整的代理URL
 */
function buildProxyUrl(baseUrl, channel) {
  return `${baseUrl}/iptv.php?id=${channel.id}`;
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

    let txtOutput = '';

    // 3. 遍历生成
    for (const group of groups) {
      // 输出分组标题
      txtOutput += `${group.group},#genre#\n`;
      
      for (const channel of group.channels) {
        // 输出格式: "频道名,中转URL"
        const proxyUrl = buildProxyUrl(baseUrl, channel);
        txtOutput += `${channel.name},${proxyUrl}\n`;
      }
      
      // 格式优化：分组结束后添加空行
      txtOutput += '\n';
    }

    // 4. 返回响应
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(txtOutput);

  } catch (error) {
    console.error('Failed to generate TXT:', error);
    res.status(500).send('Internal Server Error: Failed to generate TXT');
  }
}
