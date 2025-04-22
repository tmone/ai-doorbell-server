const mongoose = require('mongoose');

const DetectionSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1
  },
  location: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  alertSent: {
    type: Boolean,
    default: false
  },
  alertRecipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notes: {
    type: String
  }
});

const UnknownPersonSchema = new mongoose.Schema({
  faceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Face',
    required: true
  },
  detections: [DetectionSchema],
  threatLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'none'],
    default: 'low'
  },
  status: {
    type: String,
    enum: ['active', 'identified', 'false-positive', 'archived'],
    default: 'active'
  },
  possibleMatches: [{
    personType: {
      type: String,
      enum: ['employee', 'visitor']
    },
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'possibleMatches.personType'
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('UnknownPerson', UnknownPersonSchema);