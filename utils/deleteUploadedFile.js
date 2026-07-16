const fs = require('fs');
const path = require('path');
const { cloudinary } = require('../middleware/upload');

// يستخرج public_id من رابط Cloudinary. روابطنا فيها معاملات تحويل (f_auto,q_auto...)
// وممكن تجي بلا امتداد ملف، فبدل تفكيك الرابط بالكامل، نبحث مباشرة عن مجلدنا
// الثابت "yara-store/<id>" اللي نستخدمه بكل رفع.
function extractCloudinaryPublicId(url) {
  const match = url.match(/yara-store\/[^/?.]+/);
  return match ? match[0] : null;
}

// يحذف صورة قديمة بأمان — من Cloudinary لو رابط سحابي، أو من القرص المحلي
// لو مسار /uploads/ قديم (بيئة تطوير محلية). يتجاهل أي رابط آخر.
function deleteUploadedFile(url) {
  if (!url || typeof url !== 'string') return;

  if (url.includes('res.cloudinary.com')) {
    const publicId = extractCloudinaryPublicId(url);
    if (!publicId) return;
    cloudinary.uploader.destroy(publicId).catch((err) => {
      console.error('فشل حذف الصورة من Cloudinary:', publicId, err.message);
    });
    return;
  }

  if (!url.startsWith('/uploads/')) return;

  const filePath = path.join(__dirname, '..', url);

  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('فشل حذف الملف القديم:', filePath, err.message);
    }
  });
}

module.exports = deleteUploadedFile;
