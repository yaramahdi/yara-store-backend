const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'نص الإعلان مطلوب'],
    trim: true
  },
  // مخفي بالأساس — الأدمن هو من يفعّله
  isActive: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Announcement', announcementSchema);
