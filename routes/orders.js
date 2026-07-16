const express = require('express');
const Order   = require('../models/Order');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

function buildOutOfStockError(item) {
  const parts = [item.name || 'هذا المنتج'];
  if (item.selectedSize) parts.push(`(المقاس: ${item.selectedSize})`);
  const error = new Error(`عذراً، تم حجز ${parts.join(' ')} قبل إتمام الطلب. الرجاء تحديث السلة.`);
  error.code = 'OUT_OF_STOCK';
  return error;
}

async function refreshProductInStock(productId) {
  const product = await Product.findById(productId).select('sizes stock inStock');
  if (!product) return;

  let inStock = true;

  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    inStock = product.sizes.some((s) => s.stock === null || s.stock > 0);
  } else if (product.stock !== null) {
    inStock = product.stock > 0;
  }

  if (product.inStock !== inStock) {
    await Product.findByIdAndUpdate(productId, { inStock });
  }
}

// POST /api/orders — إنشاء طلب جديد (عام، بدون توثيق)
router.post('/', async (req, res) => {
  const reservedItems = [];
  const touchedProductIds = new Set();
  const preparedItems = [];

  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ message: 'لا يمكن إنشاء طلب بدون منتجات' });
    }

    // احجز المخزون أولاً. إذا فشل أي عنصر نرجع تضارب ولا ننشئ الطلب.
    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      if (!item.productId || quantity <= 0) {
        return res.status(400).json({ message: 'بيانات المنتج في الطلب غير صحيحة' });
      }

      if (item.selectedSize) {
        let updated = await Product.findOneAndUpdate(
          {
            _id: item.productId,
            sizes: { $elemMatch: { label: item.selectedSize, stock: { $gte: quantity } } }
          },
          { $inc: { 'sizes.$.stock': -quantity } },
          { new: true }
        );

        let unlimited = false;

        if (!updated) {
          // قد يكون المقاس "غير محدود" (stock = null) فلا يطابق شرط $gte — تحقق قبل رفض الطلب
          updated = await Product.findOne(
            { _id: item.productId, sizes: { $elemMatch: { label: item.selectedSize, stock: null } } },
            { rawCost: 1, price: 1, salePrice: 1 }
          );

          if (!updated) throw buildOutOfStockError(item);
          unlimited = true;
        }

        preparedItems.push({
          ...item,
          quantity,
          price: Number(updated.price || 0),
          salePrice: updated.salePrice != null ? Number(updated.salePrice) : null,
          rawCost: Number(updated.rawCost || 0),
        });

        reservedItems.push({
          productId: item.productId,
          quantity,
          selectedSize: item.selectedSize,
          unlimited,
        });
      } else {
        let updated = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $ne: null, $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true }
        );

        let unlimited = false;

        if (!updated) {
          // مخزون المنتج نفسه قد يكون "غير محدود" (stock = null)
          updated = await Product.findOne({ _id: item.productId, stock: null }, { rawCost: 1, price: 1, salePrice: 1 });

          if (!updated) throw buildOutOfStockError(item);
          unlimited = true;
        }

        preparedItems.push({
          ...item,
          quantity,
          price: Number(updated.price || 0),
          salePrice: updated.salePrice != null ? Number(updated.salePrice) : null,
          rawCost: Number(updated.rawCost || 0),
        });

        reservedItems.push({
          productId: item.productId,
          quantity,
          selectedSize: '',
          unlimited,
        });
      }

      touchedProductIds.add(String(item.productId));
    }

    const realTotalPrice = preparedItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

    const orderPayload = {
      ...body,
      items: preparedItems,
      totalPrice: realTotalPrice,
    };

    const order = await Order.create(orderPayload);

    for (const pid of touchedProductIds) {
      await refreshProductInStock(pid);
    }

    res.status(201).json(order);
  } catch (error) {
    if (reservedItems.length > 0) {
      for (let i = reservedItems.length - 1; i >= 0; i -= 1) {
        const item = reservedItems[i];
        if (item.unlimited) continue; // لم يُخصم شيء فعليًا من مخزون غير محدود
        if (item.selectedSize) {
          await Product.findOneAndUpdate(
            { _id: item.productId, 'sizes.label': item.selectedSize },
            { $inc: { 'sizes.$.stock': item.quantity } }
          );
        } else {
          await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
        }
      }

      for (const pid of touchedProductIds) {
        await refreshProductInStock(pid);
      }
    }

    if (error.code === 'OUT_OF_STOCK') {
      return res.status(409).json({ message: error.message, code: 'OUT_OF_STOCK' });
    }

    if (error?.code === 11000 && error?.keyPattern?.orderNumber) {
      return res.status(409).json({
        message: 'صار ضغط عالي على الطلبات. جرّبي مرة ثانية.',
        code: 'ORDER_NUMBER_CONFLICT',
      });
    }

    res.status(400).json({ message: 'خطأ في حفظ الطلب', error: error.message });
  }
});

// GET /api/orders — جلب كل الطلبات [أدمن]
router.get('/', protect, async (req, res) => {
  try {
    const { page, limit } = req.query;

    let query = Order.find().sort({ createdAt: -1 });

    // page/limit اختياريان — بدونهما يبقى السلوك كما هو (كل الطلبات) لتوافق الواجهة الحالية
    if (page || limit) {
      const p = Math.max(1, Number(page) || 1);
      const l = Math.max(1, Number(limit) || 50);
      query = query.skip((p - 1) * l).limit(l);
    }

    const orders = await query;
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب الطلبات' });
  }
});

// GET /api/orders/stats/dashboard — إحصائيات لوحة التحكم [أدمن]
router.get('/stats/dashboard', protect, async (req, res) => {
  try {
    // الترتيب غير مطلوب هنا (نحسب مجاميع فقط)، ونجلب الحقول المستخدمة فقط لتقليل حجم البيانات المنقولة
    const orders = await Order.find().select('status confirmedRevenue confirmedProfit totalPrice items');

    const stats = {
      totalOrders: orders.length,
      pendingOrders: 0,
      confirmedOrders: 0,
      cancelledOrders: 0,
      soldItems: 0,
      confirmedRevenue: 0,
      confirmedProfit: 0,
    };

    const productMap = new Map();

    for (const order of orders) {
      if (order.status === 'pending') stats.pendingOrders += 1;
      if (order.status === 'cancelled') stats.cancelledOrders += 1;

      if (order.status !== 'confirmed') continue;

      stats.confirmedOrders += 1;
      stats.confirmedRevenue += Number(order.confirmedRevenue ?? order.totalPrice ?? 0);
      stats.confirmedProfit += Number(order.confirmedProfit ?? 0);

      for (const item of order.items || []) {
        const qty = Number(item.quantity || 1);
        const saleUnit = Number(item.salePrice ?? item.price ?? 0);
        const rawCost = Number(item.rawCost ?? 0);
        const lineProfit = Number(item.profit ?? (saleUnit - rawCost) * qty);

        stats.soldItems += qty;

        const key = `${item.productId || ''}::${item.name || 'منتج'}`;
        const prev = productMap.get(key) || {
          productId: item.productId || '',
          name: item.name || 'منتج',
          quantity: 0,
          revenue: 0,
          profit: 0,
        };

        prev.quantity += qty;
        prev.revenue += saleUnit * qty;
        prev.profit += lineProfit;
        productMap.set(key, prev);
      }
    }

    const soldProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 12)
      .map((p) => ({
        ...p,
        revenue: Number(p.revenue.toFixed(2)),
        profit: Number(p.profit.toFixed(2)),
      }));

    res.json({
      ...stats,
      confirmedRevenue: Number(stats.confirmedRevenue.toFixed(2)),
      confirmedProfit: Number(stats.confirmedProfit.toFixed(2)),
      soldProducts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في جلب إحصائيات الطلبات' });
  }
});

// PATCH /api/orders/:id/confirm — تأكيد الطلب [أدمن]
router.patch('/:id/confirm', protect, validateObjectId, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

    const mode = req.body?.priceMode === 'custom' ? 'custom' : 'catalog';
    const customSalePrices = Array.isArray(req.body?.customSalePrices)
      ? req.body.customSalePrices.map((price) => Number(price))
      : [];
    const legacyCustomSalePrice = Number(req.body?.customSalePrice);

    if (mode === 'custom' && customSalePrices.length > 0 && customSalePrices.length !== order.items.length) {
      return res.status(400).json({ message: 'عدد أسعار البيع لا يطابق عدد قطع الطلب' });
    }

    const updatedItems = (order.items || []).map((item, index) => {
      const qty = Number(item.quantity || 1);
      const saleUnit = mode === 'custom'
        ? customSalePrices.length > 0
          ? customSalePrices[index]
          : legacyCustomSalePrice
        : Number(item.price || 0);

      if (mode === 'custom' && (!Number.isFinite(saleUnit) || saleUnit < 0)) {
        throw new Error('سعر البيع المخصص غير صالح');
      }

      const rawCost = Number(item.rawCost || 0);
      const profit = (saleUnit - rawCost) * qty;

      return {
        ...item.toObject(),
        salePrice: saleUnit,
        profit,
      };
    });

    const confirmedRevenue = updatedItems.reduce((sum, item) => {
      const qty = Number(item.quantity || 1);
      return sum + Number(item.salePrice || 0) * qty;
    }, 0);

    const confirmedProfit = updatedItems.reduce((sum, item) => sum + Number(item.profit || 0), 0);

    order.items = updatedItems;
    order.status = 'confirmed';
    order.confirmedAt = new Date();
    order.confirmedRevenue = confirmedRevenue;
    order.confirmedProfit = confirmedProfit;
    order.confirmationMode = mode === 'custom' ? 'custom_price' : 'catalog_price';
    order.totalPrice = confirmedRevenue;

    await order.save();

    const freshOrder = await Order.findById(order._id);
    res.json(freshOrder);
  } catch (error) {
    if (error.message === 'سعر البيع المخصص غير صالح') {
      return res.status(400).json({ message: 'سعر البيع المخصص غير صالح' });
    }
    res.status(400).json({ message: 'خطأ في تأكيد الطلب', error: error.message });
  }
});

// DELETE /api/orders/:id — حذف الطلب [أدمن]
router.delete('/:id', protect, validateObjectId, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف الطلب' });
  } catch (error) {
    res.status(400).json({ message: 'خطأ في حذف الطلب', error: error.message });
  }
});

module.exports = router;
