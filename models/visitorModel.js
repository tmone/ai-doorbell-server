const mongoose = require('mongoose');

const VisitSchema = new mongoose.Schema({
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: {
    type: Date,
    default: null
  },
  purpose: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  metWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }]
});

const VisitorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide visitor name'],
    trim: true
  },
  email: {
    type: String,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  phone: {
    type: String
  },
  company: {
    type: String
  },
  faceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Face',
    required: true
  },
  category: {
    type: String,
    enum: ['business', 'personal', 'delivery', 'service', 'other'],
    default: 'business'
  },
  visits: [VisitSchema],
  regularVisitor: {
    type: Boolean,
    default: false
  },
  blacklisted: {
    type: Boolean,
    default: false
  },
  blacklistReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Visitor', VisitorSchema);