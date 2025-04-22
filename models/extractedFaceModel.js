const mongoose = require('mongoose');

const FaceClusterSchema = new mongoose.Schema({
  clusterId: {
    type: String,
    required: true
  },
  faces: [{
    imageUrl: {
      type: String,
      required: true
    },
    imageData: Buffer,
    confidence: {
      type: Number,
      default: 1.0
    }
  }],
  representativeFace: {
    imageUrl: {
      type: String
    },
    imageData: Buffer
  },
  proposedLabels: [{
    label: {
      type: String
    },
    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    proposedAt: {
      type: Date,
      default: Date.now
    }
  }],
  selectedLabel: {
    type: String
  }
});

const ExtractedFaceSchema = new mongoose.Schema({
  originalFile: {
    fileId: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      enum: ['image', 'video'],
      required: true
    }
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  facesCount: {
    type: Number,
    default: 0
  },
  clusters: [FaceClusterSchema],
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  processingMessage: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isLabeled: {
    type: Boolean,
    default: false
  },
  // This links to the original session that contained the upload
  sessionId: {
    type: String
  }
});

// Add indexes for better query performance
ExtractedFaceSchema.index({ uploadedBy: 1, createdAt: -1 });
ExtractedFaceSchema.index({ 'originalFile.fileId': 1 });
ExtractedFaceSchema.index({ isLabeled: 1 });

module.exports = mongoose.model('ExtractedFace', ExtractedFaceSchema);