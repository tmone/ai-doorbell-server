const mongoose = require('mongoose');

const FaceSchema = new mongoose.Schema({
  primaryImage: {
    data: Buffer,
    contentType: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  },
  additionalImages: [{
    data: Buffer,
    contentType: String,
    angle: {
      type: String,
      enum: ['front', 'left', 'right', 'top', 'bottom'],
      default: 'front'
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  faceFeatures: {
    type: Object,  // Will store extracted facial features as vectors/embeddings
    required: true
  },
  featureVersion: {
    type: String,  // To track which version of the AI model generated these features
    required: true
  },
  qualityScore: {
    type: Number,  // Quality score of the face image for recognition purposes
    min: 0,
    max: 1
  },
  personType: {
    type: String,
    enum: ['employee', 'visitor', 'unknown'],
    required: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'personType',
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  lastDetectedDate: {
    type: Date
  },
  // New fields for verification status
  verificationStatus: {
    type: String,
    enum: ['unverified', 'verified', 'rejected'],
    default: 'unverified'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationDate: {
    type: Date
  },
  verificationNote: {
    type: String
  },
  proposedLabels: [{
    label: {
      type: String,
      required: true
    },
    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    proposedAt: {
      type: Date,
      default: Date.now
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1.0
    }
  }],
  selectedLabel: {
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

// Index for faster facial recognition queries
FaceSchema.index({ personType: 1, active: 1 });
FaceSchema.index({ verificationStatus: 1 });
FaceSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model('Face', FaceSchema);