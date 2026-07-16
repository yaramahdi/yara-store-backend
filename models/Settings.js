const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  accountNumber: { type: String, trim: true, default: '' },
  iban: { type: String, trim: true, default: '' },
  // اسم صاحب الحساب/المحفظة كما يظهر للزبون في بطاقة الدفع
  accountHolderName: { type: String, trim: true, default: '' },
  logo: { type: String, default: '' },
  isVisible: { type: Boolean, default: true }
}, { _id: true });

// كولكشن منتجات مجدول — نفس الشكل الذي ترسله واجهة الأدمن (Collections.jsx)
const collectionSchema = new mongoose.Schema({
  id:         { type: String, required: true },
  name:       { type: String, required: true, trim: true },
  launchDate: { type: Date, default: null },
  showBanner: { type: Boolean, default: false },
  products:   { type: [String], default: [] },
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  whatsappNumber: {
    type: String,
    trim: true
  },
  storeName: {
    type: String,
    default: 'يارا ستور',
    trim: true
  },
  heroImage: {
    type: String
  },
  paymentMethods: {
    type: [paymentMethodSchema],
    default: []
  },
  collections: {
    type: [collectionSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
