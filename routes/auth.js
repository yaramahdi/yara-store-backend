const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const { protect, superAdminOnly } = require('../middleware/auth');

const router = express.Router();

// حماية من محاولات تخمين كلمة المرور (Brute Force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10, // 10 محاولات كحد أقصى لكل IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'محاولات دخول كثيرة جداً. الرجاء المحاولة بعد قليل.' },
});

// توليد JWT توكن
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// POST /api/auth/login - تسجيل الدخول
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    // البحث عن الأدمن
    const admin = await Admin.findOne({ username: username.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // التحقق من كلمة المرور
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    res.json({
      _id: admin._id,
      username: admin.username,
      role: admin.role,
      token: generateToken(admin._id)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// POST /api/auth/create-admin - إنشاء أدمن جديد (للسوبر أدمن فقط)
router.post('/create-admin', protect, superAdminOnly, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    // التحقق من عدم تكرار اسم المستخدم
    const exists = await Admin.findOne({ username: username.toLowerCase() });
    if (exists) {
      return res.status(400).json({ message: 'اسم المستخدم مستخدم بالفعل' });
    }

    const admin = await Admin.create({
      username,
      password,
      role: role || 'admin'
    });

    res.status(201).json({
      _id: admin._id,
      username: admin.username,
      role: admin.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
