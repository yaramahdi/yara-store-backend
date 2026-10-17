const mongoose = require('mongoose');

// طرد توريد — مجموعة منتجات جابتها يارا سوا بشحنة/طلبية وحدة، لمعرفة
// يجمع منتجات شحنة واحدة لمتابعة مبيعاتها ومصروفها وصافي نتيجتها.
const parcelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم الطرد مطلوب'],
    trim: true,
  },
  // محفوظ للتوافق مع الطرود القديمة؛ كان يمثل تكلفة التنسيق/الشحن فقط.
  styleCost: {
    type: Number,
    min: 0,
    default: 0,
  },
  // كامل المبلغ المصروف على الطرد، بما فيه تكلفة المنتجات والتنسيق/الشحن.
  totalCost: {
    type: Number,
    min: 0,
  },
  // المنتجات المرتبطة بهالطرد — نفس منتجات الموقع العادية، بلا أي تعديل عليها
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Parcel', parcelSchema);
