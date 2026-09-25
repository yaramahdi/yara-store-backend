const express = require('express');
const jwt = require('jsonwebtoken');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const deleteUploadedFile = require('../utils/deleteUploadedFile');

const router = express.Router();

// GET /api/settings - جلب إعدادات المتجر (عام). أكواد الخصم حساسة تجارياً، فما
// بترجع إلا لو الطلب جاي من أدمن مسجّل دخول (تحقق اختياري من التوكن — بلا ما
// نرفض الطلب العام لو ما في توكن، عكس middleware/auth.protect)
router.get('/', async (req, res) => {
  try {
    // دائماً نجلب أول وثيقة - الإعدادات وثيقة وحيدة
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ storeName: 'يارا ستور' });
    }

    let isAdmin = false;
    const token = req.headers.authorization?.startsWith('Bearer')
      ? req.headers.authorization.split(' ')[1]
      : null;
    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET);
        isAdmin = true;
      } catch {
        // توكن غير صالح/منتهي — نتعامل مع الطلب كطلب عام بلا رفض
      }
    }

    const result = settings.toObject();
    if (!isAdmin) delete result.discountCodes;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب الإعدادات' });
  }
});

// POST /api/settings/validate-discount - التحقق من كود خصم وقت الحجز [عام]
// بيرجع بس نتيجة الكود المُدخل (صالح/غير صالح + النسبة)، مش كل الأكواد —
// حتى ما تنكشف باقي الأكواد لأي زائر عبر الشبكة
router.post('/validate-discount', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const orderTotal = Number(req.body?.orderTotal || 0);
    if (!code) {
      return res.status(400).json({ valid: false, message: 'أدخلي كود الخصم' });
    }

    const settings = await Settings.findOne().select('discountCodes');
    const match = settings?.discountCodes?.find((d) => d.code === code && d.isActive);

    if (!match) {
      return res.json({ valid: false, message: 'كود الخصم غير صالح' });
    }

    const minOrderTotal = Number(match.minOrderTotal || 0);
    if (orderTotal < minOrderTotal) {
      return res.json({
        valid: false,
        message: `هذا الكود صالح للطلبات بقيمة ${minOrderTotal} شيكل فأكثر`,
        minOrderTotal,
      });
    }

    res.json({ valid: true, code: match.code, percent: match.percent, minOrderTotal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ valid: false, message: 'خطأ في التحقق من كود الخصم' });
  }
});

// PUT /api/settings - تحديث إعدادات المتجر [auth]
router.put('/', protect, upload.single('heroImage'), upload.uploadToCloudinary, async (req, res) => {
  try {
    const updateData = { ...req.body };

    const before = req.file ? await Settings.findOne().select('heroImage') : null;

    if (req.file) {
      updateData.heroImage = req.file.url;
    }

    // تنظيف _id لطرق الدفع: نحذف أي _id غير صالح حتى يولّده MongoDB من جديد
    if (Array.isArray(updateData.paymentMethods)) {
      updateData.paymentMethods = updateData.paymentMethods.map(m => {
        const cleaned = { ...m };
        if (cleaned._id && !/^[a-fA-F0-9]{24}$/.test(cleaned._id)) {
          delete cleaned._id;
        }
        return cleaned;
      });
    }

    // نفس التنظيف لأكواد الخصم (نفس نمط الإضافة المؤقتة بالفرونت)
    if (Array.isArray(updateData.discountCodes)) {
      updateData.discountCodes = updateData.discountCodes.map(d => {
        const cleaned = { ...d };
        if (cleaned._id && !/^[a-fA-F0-9]{24}$/.test(cleaned._id)) {
          delete cleaned._id;
        }
        return cleaned;
      });
    }

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true }
    );

    if (before?.heroImage && before.heroImage !== settings.heroImage) {
      deleteUploadedFile(before.heroImage);
    }

    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: 'خطأ في تحديث الإعدادات', error: error.message });
  }
});

module.exports = router;
