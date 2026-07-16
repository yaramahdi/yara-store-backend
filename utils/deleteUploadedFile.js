const fs = require('fs');
const path = require('path');

// يحذف ملف صورة محلي من مجلد uploads بأمان — يتجاهل الروابط الخارجية (http) والملفات غير الموجودة
function deleteUploadedFile(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return;

  const filePath = path.join(__dirname, '..', url);

  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('فشل حذف الملف القديم:', filePath, err.message);
    }
  });
}

module.exports = deleteUploadedFile;
