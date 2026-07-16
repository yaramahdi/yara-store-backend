const express = require('express');
const Announcement = require('../models/Announcement');
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

// GET /api/announcements - جلب الإعلانات النشطة فقط (للزوار)
router.get('/', async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب الإعلانات' });
  }
});

// GET /api/announcements/all - جلب كل الإعلانات [auth]
router.get('/all', protect, async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب الإعلانات' });
  }
});

// PATCH /api/announcements/:id/toggle - تفعيل/تعطيل إعلان [auth]
router.patch('/:id/toggle', protect, validateObjectId, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'الإعلان غير موجود' });
    }
    announcement.isActive = !announcement.isActive;
    await announcement.save();
    res.json({
      message: announcement.isActive ? 'تم تفعيل الإعلان' : 'تم إخفاء الإعلان',
      announcement
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في تحديث الإعلان' });
  }
});

// POST /api/announcements - إضافة إعلان [auth]
router.post('/', protect, async (req, res) => {
  try {
    const { text, isActive } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'نص الإعلان مطلوب' });
    }

    const announcement = await Announcement.create({ text, isActive });
    res.status(201).json(announcement);
  } catch (error) {
    res.status(400).json({ message: 'خطأ في إضافة الإعلان', error: error.message });
  }
});

// PUT /api/announcements/:id - تحديث إعلان [auth]
router.put('/:id', protect, validateObjectId, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ message: 'الإعلان غير موجود' });
    }

    res.json(announcement);
  } catch (error) {
    res.status(400).json({ message: 'خطأ في تحديث الإعلان', error: error.message });
  }
});

// DELETE /api/announcements/:id - حذف إعلان [auth]
router.delete('/:id', protect, validateObjectId, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: 'الإعلان غير موجود' });
    }
    res.json({ message: 'تم حذف الإعلان بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في حذف الإعلان' });
  }
});

module.exports = router;
