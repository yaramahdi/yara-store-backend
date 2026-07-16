const express = require('express');
const mongoose = require('mongoose');
const Product  = require('../models/Product');
const Category = require('../models/Category');
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const deleteUploadedFile = require('../utils/deleteUploadedFile');

const router = express.Router();

// GET /api/products/admin/list — جلب كل المنتجات للأدمن مع حقول داخلية
router.get('/admin/list', protect, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 200 } = req.query;

    const query = {};
    if (category) query.category = category;

    if (search) {
      const matchingCategories = await Category.find(
        { name: { $regex: search, $options: 'i' } },
        '_id'
      );
      const catIds = matchingCategories.map(c => c._id);
      query.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        ...(catIds.length ? [{ category: { $in: catIds } }] : []),
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب منتجات الأدمن' });
  }
});

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;

    const query = { isVisible: true };
    if (category) query.category = category;

    if (search) {
      const matchingCategories = await Category.find(
        { name: { $regex: search, $options: 'i' } },
        '_id'
      );
      const catIds = matchingCategories.map(c => c._id);
      query.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        ...(catIds.length ? [{ category: { $in: catIds } }] : []),
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .select('-rawCost')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب المنتجات' });
  }
});

// POST /api/products/stock-status — جلب حالة المخزون لمجموعة منتجات محددة
router.post('/stock-status', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map(String).filter(Boolean).filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];

    if (ids.length === 0) {
      return res.json({ products: [] });
    }

    const products = await Product.find({ _id: { $in: ids } })
      .select('_id inStock stock');

    return res.json({
      products: products.map((p) => ({
        _id: String(p._id),
        inStock: p.inStock,
        stock: p.stock,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'خطأ في جلب حالة المخزون' });
  }
});

// GET /api/products/:id
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isVisible: true })
      .select('-rawCost')
      .populate('category', 'name')
      .populate({ path: 'linkedColors.productId', select: 'name images image' });
    if (!product) return res.status(404).json({ message: 'المنتج غير موجود' });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب المنتج' });
  }
});

// POST /api/products
router.post('/', protect, async (req, res) => {
  try {
    const productData = { ...req.body };
    if (typeof productData.sizes        === 'string') productData.sizes        = JSON.parse(productData.sizes);
    if (typeof productData.sizeGuide    === 'string') productData.sizeGuide    = JSON.parse(productData.sizeGuide);
    if (typeof productData.linkedColors === 'string') productData.linkedColors = JSON.parse(productData.linkedColors);
    if (typeof productData.images       === 'string') productData.images       = JSON.parse(productData.images);

    const product   = await Product.create(productData);
    const populated = await product.populate('category', 'name');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: 'خطأ في إضافة المنتج', error: error.message });
  }
});

// PUT /api/products/:id
router.put('/:id', protect, validateObjectId, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (typeof updateData.sizes        === 'string') updateData.sizes        = JSON.parse(updateData.sizes);
    if (typeof updateData.sizeGuide    === 'string') updateData.sizeGuide    = JSON.parse(updateData.sizeGuide);
    if (typeof updateData.linkedColors === 'string') updateData.linkedColors = JSON.parse(updateData.linkedColors);
    if (typeof updateData.images       === 'string') updateData.images       = JSON.parse(updateData.images);

    const thisId       = req.params.id;
    const thisName     = updateData.colorName || '';
    const newLinkedIds = Array.isArray(updateData.linkedColors)
      ? updateData.linkedColors.map(c => String(c.productId)).filter(Boolean)
      : [];

    // جلب الروابط والصور القديمة لمعرفة ما تم حذفه
    const before = await Product.findById(thisId).select('linkedColors images image');
    const oldLinkedIds = (before?.linkedColors || []).map(c => String(c.productId));
    const oldImages = [...(before?.images || []), before?.image].filter(Boolean);

    const updated = await Product.findByIdAndUpdate(
      thisId,
      updateData,
      { new: true, runValidators: true }
    ).populate('category', 'name');

    if (!updated) return res.status(404).json({ message: 'المنتج غير موجود' });

    // احذف ملفات الصور القديمة التي لم تعد مستخدمة بعد التحديث
    if (updateData.images !== undefined || updateData.image !== undefined) {
      const newImages = [...(updated.images || []), updated.image].filter(Boolean);
      oldImages
        .filter((url) => !newImages.includes(url))
        .forEach(deleteUploadedFile);
    }

    // ── ربط تلقائي من الطرفين ──
    // أضف هذا المنتج لكل منتج مرتبط جديد
    for (const linkedId of newLinkedIds) {
      await Product.updateOne(
        {
          _id: linkedId,
          'linkedColors.productId': { $ne: thisId }
        },
        {
          $push: { linkedColors: { productId: thisId, name: thisName } },
          $set:  { colorName: updated.linkedColors.find(c => String(c.productId) === linkedId)?.name || '' }
        }
      );
    }

    // احذف هذا المنتج من المنتجات التي أُزيل ربطها
    const removedIds = oldLinkedIds.filter(id => !newLinkedIds.includes(id));
    for (const removedId of removedIds) {
      await Product.updateOne(
        { _id: removedId },
        { $pull: { linkedColors: { productId: thisId } } }
      );
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'خطأ في تحديث المنتج', error: error.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', protect, validateObjectId, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'المنتج غير موجود' });
    [...(product.images || []), product.image].filter(Boolean).forEach(deleteUploadedFile);

    // إزالة أي ربط ألوان في منتجات أخرى تشير للمنتج المحذوف
    await Product.updateMany(
      { 'linkedColors.productId': product._id },
      { $pull: { linkedColors: { productId: product._id } } }
    );

    res.json({ message: 'تم حذف المنتج بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في حذف المنتج' });
  }
});

// PATCH /api/products/:id/toggle-visibility
router.patch('/:id/toggle-visibility', protect, validateObjectId, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'المنتج غير موجود' });
    product.isVisible = !product.isVisible;
    await product.save();
    res.json({ isVisible: product.isVisible });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في تغيير حالة المنتج' });
  }
});

module.exports = router;
