const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// 这个 API 用于处理 /data/* 的请求
// 因为 Vercel 默认只把 public 文件夹作为静态资源
// 为了满足 "放在 data 目录而不是 public/data" 的需求，我们需要手动读取并返回文件

export default function handler(req, res) {
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).send('Filename missing');
  }

  // 防止目录遍历攻击
  const safeFilename = filename.replace(/\.\./g, '');
  
  // 定位文件：根目录/data/文件名
  const filePath = path.join(process.cwd(), 'data', safeFilename);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  try {
    // 获取 MIME 类型
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);

    // 对于视频文件，支持 Range 请求 (流式播放)
    // 简单的全量读取对于大文件在 Serverless Function 中可能有性能问题，
    // 但对于几十兆以内的短视频(测试卡)通常是可以的。
    // 如果需要完美的流媒体支持，通常建议使用 public 目录或对象存储。
    
    // 这里使用流式传输以节省内存
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error serving file');
  }
}
