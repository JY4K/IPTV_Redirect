const fs = require('fs');
const path = require('path');

// 辅助函数：解析 playlist.txt 并查找对应 ID 的 URL
function findUrlById(targetId) {
  try {
    const filePath = path.join(process.cwd(), 'data', 'playlist.txt');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      // 跳过空行和分组行
      if (!trimmedLine || trimmedLine.includes('#genre#')) continue;

      const [name, url] = trimmedLine.split(',');
      if (!name || !url) continue;

      // 逻辑：提取名称的第一部分作为 ID (例如 "CCTV1 综合" -> "CCTV1")
      // 如果没有空格，则整个名称就是 ID (例如 "浙江卫视" -> "浙江卫视")
      const currentId = name.split(' ')[0];

      if (currentId === targetId || name === targetId) {
        return url.trim();
      }
    }
  } catch (error) {
    console.error('Error reading playlist:', error);
  }
  return null;
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).send('Missing "id" parameter');
  }

  const streamUrl = findUrlById(id);

  if (streamUrl) {
    // 找到源，直接 302 重定向到真实地址
    // 这种方式最省流量，也符合 Vercel 限制
    return res.redirect(302, streamUrl);
  } else {
    return res.status(404).send(`Channel "${id}" not found.`);
  }
}