const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// ── Middleware ──────────────────────────────────────────────
// crossOriginResourcePolicy: 'cross-origin' حتى تبقى صور /uploads قابلة للتحميل من
// دومين الواجهة (عادة مختلف عن دومين الـ API). contentSecurityPolicy: false لأن
// هذا سيرفر API + ملفات صور ثابتة، وليس صفحات HTML يحتاج CSP لحمايتها.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
// CORS: نقيّده بعنوان الواجهة الحقيقي عبر FRONTEND_URL في بيئة الإنتاج، مع إبقاء
// عناوين تطوير Vite/CRA المحلية مسموحة دائماً. إذا لم يُضبط FRONTEND_URL بعد
// (مثلاً أول نشر)، يبقى CORS مفتوحاً كما كان سابقاً حتى لا يتعطل المتجر بالخطأ.
if (process.env.FRONTEND_URL) {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4173',
  ];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('CORS: غير مسموح لهذا المصدر'));
    },
  }));
} else {
  console.log('⚠️ FRONTEND_URL غير مضبوط في .env — CORS مفتوح لكل المصادر مؤقتاً.');
  app.use(cors());
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تقديم مجلد الصور بشكل ثابت
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/products',      require('./routes/products'));
app.use('/api/categories',    require('./routes/categories'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/orders',        require('./routes/orders'));

// ── رفع الصور ──────────────────────────────────────────────
const upload = require('./middleware/upload');
const { protect } = require('./middleware/auth');

app.post('/api/upload', protect, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'لم يتم رفع أي صورة' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// صفحة ترحيب للتحقق أن السيرفر شغّال
app.get('/', (req, res) => {
  res.json({ message: 'مرحباً بك في API يارا ستور', status: 'running' });
});

// معالجة المسارات غير الموجودة
app.use((req, res) => {
  res.status(404).json({ message: 'المسار غير موجود' });
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
  console.error(err.stack);

  // خطأ multer (رفع الملفات)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'حجم الصورة يتجاوز 5MB' });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? 'خطأ داخلي في الخادم' : (err.message || 'خطأ داخلي في الخادم')
  });
});

// ── إنشاء السوبر أدمن تلقائياً عند أول تشغيل ─────────────
const createDefaultAdmin = async () => {
  try {
    const Admin = require('./models/Admin');
    const exists = await Admin.findOne({ username: 'admin' });
    if (!exists) {
      const password = process.env.DEFAULT_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
      await Admin.create({
        username: 'admin',
        password,
        role: 'superadmin'
      });
      console.log(`✅ تم إنشاء السوبر أدمن: admin / ${password}`);
      if (!process.env.DEFAULT_ADMIN_PASSWORD) {
        console.log('⚠️ غيّري كلمة المرور هذه فوراً من لوحة التحكم، ولن تُطبع مرة أخرى.');
      }
    }
  } catch (error) {
    console.error('❌ خطأ في إنشاء السوبر أدمن:', error.message);
  }
};

// ── الاتصال بقاعدة البيانات وتشغيل السيرفر ─────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅conected MongoDB');
    await createDefaultAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 server on port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌failed :', err.message);
    process.exit(1);
  });
