const http = require('http');
const https = require('https');
const url = require('url');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // إعدادات الـ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // EndPoint للبحث عن التورنت بواسطة اسم الفيلم/المسلسل عبر Python
  if (parsedUrl.pathname === '/api/torrent-search') {
    const q = parsedUrl.query.q;

    if (!q) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'يرجى إرسال كلمة البحث q' }));
    }

    // تنظيف النص لتفادي أخطاء الأوامر
    const sanitizedQuery = q.replace(/"/g, '\\"');

    // تشغيل سكربت البايثون tpb_search.py
    exec(`python3 tpb_search.py "${sanitizedQuery}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Python Exec Error:', error);
        res.writeHead(500);
        return res.end(JSON.stringify({ success: false, error: 'حدث خطأ أثناء تشغيل سكربت البحث' }));
      }

      try {
        const data = JSON.parse(stdout);
        return res.end(JSON.stringify(data));
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, stdout);
        res.writeHead(500);
        return res.end(JSON.stringify({ success: false, error: 'فشل معالجة مخرجات البايثون' }));
      }
    });
    return;
  }

  // الصفحة الرئيسية للسيرفر
  res.end(JSON.stringify({ message: 'StreamFlix Active' }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
