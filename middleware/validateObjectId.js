const mongoose = require('mongoose');

// يتحقق من أن req.params.id هو ObjectId صالح قبل أي findById/update/delete
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'معرف غير صالح' });
  }
  next();
};

module.exports = validateObjectId;
