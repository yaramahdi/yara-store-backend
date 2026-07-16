const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validateObjectId = require('../middleware/validateObjectId');
const deleteUploadedFile = require('../utils/deleteUploadedFile');

const router = express.Router();

// GET /api/categories - جلب كل التصنيفات مع فلترة حسب النوع
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ order: 1, createdAt: 1 });
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب التصنيفات' });
  }
});

// POST /api/categories - إضافة تصنيف جديد [auth]
router.post('/', protect, upload.single('image'), upload.uploadToCloudinary, async (req, res) => {
  try {
    const categoryData = { ...req.body };

    if (req.file) {
      categoryData.image = req.file.url;
    }

    const category = await Category.create(categoryData);
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: 'خطأ في إضافة التصنيف', error: error.message });
  }
});

// PUT /api/categories/:id - تحديث تصنيف [auth]
router.put('/:id', protect, validateObjectId, upload.single('image'), upload.uploadToCloudinary, async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.file) {
      updateData.image = req.file.url;
    }

    const before = req.file ? await Category.findById(req.params.id).select('image') : null;

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'التصنيف غير موجود' });
    }

    if (before?.image && before.image !== category.image) {
      deleteUploadedFile(before.image);
    }

    res.json(category);
  } catch (error) {
    res.status(400).json({ message: 'خطأ في تحديث التصنيف', error: error.message });
  }
});

// DELETE /api/categories/:id - حذف تصنيف [auth]
router.delete('/:id', protect, validateObjectId, async (req, res) => {
  try {
    const inUse = await Product.exists({ category: req.params.id });
    if (inUse) {
      return res.status(400).json({
        message: 'لا يمكن حذف هذا التصنيف لأنه مرتبط بمنتجات. أعيدي تصنيف أو احذفي هذه المنتجات أولاً.',
      });
    }

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'التصنيف غير موجود' });
    }
    deleteUploadedFile(category.image);
    res.json({ message: 'تم حذف التصنيف بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في حذف التصنيف' });
  }
});

module.exports = router;
