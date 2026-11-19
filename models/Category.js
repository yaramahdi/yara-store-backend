const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم التصنيف مطلوب'],
    trim: true
  },
  // مسار صورة التصنيف
  image: {
    type: String
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  department: {
    type: String,
    enum: ['clothes', 'shoes'],
    default: 'clothes'
  },
  // ترتيب الظهور في الواجهة
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);
