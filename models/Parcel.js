const mongoose = require('mongoose');

// طرد توريد — مجموعة منتجات جابتها يارا سوا بشحنة/طلبية وحدة، لمعرفة
// هل هالشحنة (بعد خصم تكلفة التنسيق/الشحن) ربحت منيح أو خسرت بعد ما
// تنباع قطعها فعلياً. الربح نفسه بينحسب من بيانات الطلبات المؤكدة
// الحقيقية (نفس منطق تأكيد الطلب الموجود أصلاً) — الطرد بس بيجمّعه.
const parcelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم الطرد مطلوب'],
    trim: true,
  },
  // تكلفة التنسيق/الشحن لكامل الطرد (مبلغ واحد يُخصم من مجموع ربح قطعه)
  styleCost: {
    type: Number,
    min: 0,
    default: 0,
  },
  // المنتجات المرتبطة بهالطرد — نفس منتجات الموقع العادية، بلا أي تعديل عليها
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Parcel', parcelSchema);
