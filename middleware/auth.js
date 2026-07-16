const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// التحقق من صحة JWT
const protect = async (req, res, next) => {
  try {
    let token;

    // استخراج التوكن من الـ header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'غير مصرح، يرجى تسجيل الدخول' });
    }

    // فك تشفير التوكن والتحقق منه
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // التحقق من وجود الأدمن في قاعدة البيانات
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'المستخدم غير موجود' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'توكن غير صالح' });
  }
};

// التحقق من صلاحية السوبر أدمن
const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== 'superadmin') {
    return res.status(403).json({ message: 'هذا الإجراء للسوبر أدمن فقط' });
  }
  next();
};

module.exports = { protect, superAdminOnly };
