const mongoose = require('mongoose');
const Counter = require('./Counter');

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  name:      { type: String, required: true },
  price:     { type: Number, default: 0 },
  rawCost:   { type: Number, default: 0 },
  salePrice: { type: Number, default: null },
  profit:    { type: Number, default: 0 },
  quantity:  { type: Number, default: 1 },
  selectedColor: { name: String, hex: String },
  selectedSize:  { type: String, default: '' },
  images:    [String],
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  customer: {
    name:    { type: String, required: true },
    phone:   { type: String, default: '' },
    address: { type: String, default: '' },
  },
  items:      { type: [orderItemSchema], default: [] },
  totalPrice: { type: Number, default: 0 },
  paymentMethod: {
    name:              { type: String, default: '' },
    accountNumber:     { type: String, default: '' },
    iban:              { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
  },
  confirmedAt: { type: Date, default: null },
  confirmedRevenue: { type: Number, default: 0 },
  confirmedProfit: { type: Number, default: 0 },
  confirmationMode: {
    type: String,
    enum: ['', 'catalog_price', 'custom_price'],
    default: '',
  },
}, { timestamps: true });

orderSchema.index({ createdAt: -1 });

// توليد رقم الطلب تلقائياً بشكل ذري لمنع التكرار مع الحذف أو الطلبات المتزامنة.
orderSchema.pre('save', async function (next) {
  if (this.orderNumber) return next();

  try {
    const Order = mongoose.model('Order');

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const counter = await Counter.findByIdAndUpdate(
        'orderNumber',
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const candidate = `ORD-${String(counter.seq).padStart(4, '0')}`;
      const exists = await Order.exists({ orderNumber: candidate });
      if (!exists) {
        this.orderNumber = candidate;
        return next();
      }
    }

    return next(new Error('تعذر توليد رقم طلب فريد. حاول مرة أخرى.'));
  } catch (error) {
    return next(error);
  }
});

module.exports = mongoose.model('Order', orderSchema);
