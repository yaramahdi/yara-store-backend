const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// الملف يُحفظ بالذاكرة مؤقتاً فقط، ثم يُرفع لـ Cloudinary — سيرفرات
// الاستضافة (Render وغيرها) عندها قرص مؤقت (ephemeral) بينمسح عند كل
// إعادة تشغيل، فحفظ الصور محلياً يفقدها بعد فترة قصيرة.
const storage = multer.memoryStorage();

// التحقق من نوع الملف - صور فقط
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpg|jpeg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    const err = new Error('يُسمح فقط بصور jpg, jpeg, png, webp');
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // حد أقصى 5MB
  }
});

// يرفع الملف من الذاكرة إلى Cloudinary ويضيف الرابط الناتج على req.file.url
// لازم يجي بعد upload.single(...)/upload.fields(...) بنفس السلسلة
const uploadToCloudinary = (req, res, next) => {
  if (!req.file) return next();

  const stream = cloudinary.uploader.upload_stream(
    { folder: 'yara-store' },
    (error, result) => {
      if (error) return next(error);
      // f_auto/q_auto: يختار Cloudinary الصيغة والجودة المناسبة لكل زائر تلقائياً
      // (WebP للمتصفحات الحديثة مثلاً) بدل تخزين نسخة واحدة ثابتة الحجم.
      // width/crop=limit: يحدّ صور المنتجات بعرض 1600px كحد أقصى (يكفي لأي
      // عرض بالمتجر) بدل رفع صور كاميرا الجوال بحجمها الكامل بلا داعٍ.
      req.file.url = cloudinary.url(result.public_id, {
        secure: true,
        fetch_format: 'auto',
        quality: 'auto',
        width: 1600,
        crop: 'limit',
      });
      req.file.publicId = result.public_id;
      next();
    }
  );
  stream.end(req.file.buffer);
};

module.exports = upload;
module.exports.uploadToCloudinary = uploadToCloudinary;
module.exports.cloudinary = cloudinary;
