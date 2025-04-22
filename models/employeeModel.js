const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  entryTime: {
    type: Date,
    default: null
  },
  exitTime: {
    type: Date,
    default: null
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day'],
    default: 'present'
  }
});

const EmployeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: [true, 'Please provide an employee ID'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Please provide name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  phone: {
    type: String,
    required: [true, 'Please provide phone number']
  },
  department: {
    type: String,
    required: [true, 'Please provide department']
  },
  position: {
    type: String,
    required: [true, 'Please provide position']
  },
  faceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Face',
    required: true
  },
  attendance: [AttendanceSchema],
  joiningDate: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
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

module.exports = mongoose.model('Employee', EmployeeSchema);