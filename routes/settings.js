const express = require('express');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const deleteUploadedFile = require('../utils/deleteUploadedFile');

const router = express.Router();

// GET /api/settings - جلب إعدادات المتجر
router.get('/', async (req, res) => {
  try {
    // دائماً نجلب أول وثيقة - الإعدادات وثيقة وحيدة
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ storeName: 'يارا ستور' });
    }
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب الإعدادات' });
  }
});

// PUT /api/settings - تحديث إعدادات المتجر [auth]
router.put('/', protect, upload.single('heroImage'), async (req, res) => {
  try {
    const updateData = { ...req.body };

    const before = req.file ? await Settings.findOne().select('heroImage') : null;

    if (req.file) {
      updateData.heroImage = `/uploads/${req.file.filename}`;
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
