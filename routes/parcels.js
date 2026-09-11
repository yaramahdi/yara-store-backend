const express = require('express');
const Parcel  = require('../models/Parcel');
const Product = require('../models/Product');
const Order   = require('../models/Order');
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

// كل مسارات الطرود داخلية (بيانات تكلفة وربح) — أدمن فقط
router.use(protect);

// يبني خريطة productId → إجمالي المبيع (كمية/إيراد/ربح) من الطلبات المؤكدة فقط،
// بنفس منطق حساب الربح المستخدم أصلاً وقت تأكيد الطلب (routes/orders.js)
async function buildSoldStatsMap() {
  const confirmedOrders = await Order.find({ status: 'confirmed' }).select('items');
  const map = new Map();

  for (const order of confirmedOrders) {
    for (const item of order.items || []) {
      if (!item.productId) continue; // منتج محذوف وقت الطلب — ما بقدر أربطه بطرد

      const qty = Number(item.quantity || 1);
      const saleUnit = Number(item.salePrice ?? item.price ?? 0);
      const rawCost = Number(item.rawCost ?? 0);
      const lineProfit = Number(item.profit ?? (saleUnit - rawCost) * qty);

      const prev = map.get(item.productId) || { quantity: 0, revenue: 0, profit: 0 };
      prev.quantity += qty;
      prev.revenue += saleUnit * qty;
      prev.profit += lineProfit;
      map.set(item.productId, prev);
    }
  }

  return map;
}

// GET /api/parcels — كل الطرود مع ملخص الربح لكل وحد
router.get('/', async (req, res) => {
  try {
    const [parcels, soldMap] = await Promise.all([
      Parcel.find().populate('products', 'name images image').sort({ createdAt: -1 }),
      buildSoldStatsMap(),
    ]);

    const result = parcels.map((parcel) => {
      // منتج محذوف بقى مرجعه بلا داتا (populate بيرجعه null) — استبعديه دفاعياً
      const products = (parcel.products || []).filter(Boolean);

      let soldQty = 0;
      let actualRevenue = 0;
      let actualProfit = 0;

      for (const product of products) {
        const stat = soldMap.get(String(product._id));
        if (!stat) continue;
        soldQty += stat.quantity;
        actualRevenue += stat.revenue;
        actualProfit += stat.profit;
      }

      const styleCost = Number(parcel.styleCost || 0);

      return {
        _id: parcel._id,
        name: parcel.name,
        styleCost,
        productsCount: products.length,
        products,
        soldQty,
        actualRevenue: Number(actualRevenue.toFixed(2)),
        actualProfit: Number(actualProfit.toFixed(2)),
        netProfit: Number((actualProfit - styleCost).toFixed(2)),
        createdAt: parcel.createdAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب الطرود' });
  }
});

// GET /api/parcels/:id — طرد واحد مع تفصيل الربح لكل قطعة فيه
router.get('/:id', validateObjectId, async (req, res) => {
  try {
    const parcel = await Parcel.findById(req.params.id).populate('products');
    if (!parcel) return res.status(404).json({ message: 'الطرد غير موجود' });

    const soldMap = await buildSoldStatsMap();

    let styleCost = Number(parcel.styleCost || 0);
    let actualRevenue = 0;
    let actualProfit = 0;
    let soldQty = 0;

    // منتج محذوف بقى مرجعه بلا داتا (populate بيرجعه null) — استبعديه دفاعياً
    const products = (parcel.products || []).filter(Boolean).map((product) => {
      const stat = soldMap.get(String(product._id)) || { quantity: 0, revenue: 0, profit: 0 };
      soldQty += stat.quantity;
      actualRevenue += stat.revenue;
      actualProfit += stat.profit;

      return {
        _id: product._id,
        name: product.name,
        price: product.price,
        rawCost: product.rawCost,
        images: product.images,
        image: product.image,
        soldQty: stat.quantity,
        soldRevenue: Number(stat.revenue.toFixed(2)),
        soldProfit: Number(stat.profit.toFixed(2)),
      };
    });

    res.json({
      _id: parcel._id,
      name: parcel.name,
      styleCost,
      products,
      soldQty,
      actualRevenue: Number(actualRevenue.toFixed(2)),
      actualProfit: Number(actualProfit.toFixed(2)),
      netProfit: Number((actualProfit - styleCost).toFixed(2)),
      createdAt: parcel.createdAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب الطرد' });
  }
});

// POST /api/parcels — إنشاء طرد جديد
router.post('/', async (req, res) => {
  try {
    const { name, styleCost, products } = req.body;

    const parcel = await Parcel.create({
      name,
      styleCost: Number(styleCost) || 0,
      products: Array.isArray(products) ? products : [],
    });

    res.status(201).json(parcel);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors)[0].message });
    }
    console.error(error);
    res.status(500).json({ message: 'خطأ في إنشاء الطرد' });
  }
});

// PUT /api/parcels/:id — تعديل طرد
router.put('/:id', validateObjectId, async (req, res) => {
  try {
    const { name, styleCost, products } = req.body;

    const parcel = await Parcel.findByIdAndUpdate(
      req.params.id,
      {
        name,
        styleCost: Number(styleCost) || 0,
        products: Array.isArray(products) ? products : [],
      },
      { new: true, runValidators: true }
    );

    if (!parcel) return res.status(404).json({ message: 'الطرد غير موجود' });
    res.json(parcel);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors)[0].message });
    }
    console.error(error);
    res.status(500).json({ message: 'خطأ في تعديل الطرد' });
  }
});

// DELETE /api/parcels/:id — حذف طرد (المنتجات نفسها ما بتنحذف، بس بتصير بلا طرد)
router.delete('/:id', validateObjectId, async (req, res) => {
  try {
    const parcel = await Parcel.findByIdAndDelete(req.params.id);
    if (!parcel) return res.status(404).json({ message: 'الطرد غير موجود' });
    res.json({ message: 'تم حذف الطرد' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في حذف الطرد' });
  }
});

module.exports = router;
