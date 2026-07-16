const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم المنتج مطلوب'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'سعر المنتج مطلوب'],
    min: 0
  },
  // السعر الخام (تكلفة القطعة) للاستخدام الداخلي في حساب الربح
  rawCost: {
    type: Number,
    min: 0,
    default: 0
  },
  // السعر الأصلي قبل الخصم (يظهر مشطوباً)
  salePrice: {
    type: Number,
    min: 0,
    default: null
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'تصنيف المنتج مطلوب']
  },
  // المقاسات — كل مقاس له كميته الخاصة
  sizes: [
    {
      label: { type: String, required: true, trim: true },
      stock: { type: Number, default: null, min: 0 }
    }
  ],
  // جدول مقاسات للعرض (مقاس + مواصفات)
  sizeGuide: [
    {
      size:  { type: String, trim: true },
      specs: { type: String, trim: true }
    }
  ],
  // ليبل/باج (جديد، عرض خاص، نص حر)
  label: {
    type: String,
    trim: true,
    default: ''
  },
  // إخفاء شريط "آخر قطعة" عند الكمية = 1
  hideLastPiece: {
    type: Boolean,
    default: false
  },
  // اسم لون هذا المنتج
  colorName: {
    type: String,
    trim: true,
    default: ''
  },
  // ربط ألوان — منتجات أخرى لنفس القطعة بألوان مختلفة
  linkedColors: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name:      { type: String, trim: true }
    }
  ],
  // مسارات الصور
  images: [String],
  image:  { type: String, default: '' },
  description: {
    type: String,
    trim: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  // null = غير محدود، رقم = كمية محددة
  stock: {
    type: Number,
    default: null,
    min: 0
  }
}, {
  timestamps: true
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
