const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'user'],
    default: 'user'
  },
  // New fields for permissions
  permissions: {
    canVerifyFaces: {
      type: Boolean,
      default: false
    },
    canManageUsers: {
      type: Boolean,
      default: false
    },
    canManageAllFaces: {
      type: Boolean,
      default: false
    },
    canViewAllData: {
      type: Boolean,
      default: false
    }
  },
  // Track labels created by this user
  createdLabels: [{
    type: String
  }],
  department: {
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

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  
  // Set default permissions based on role
  if (this.isModified('role')) {
    if (this.role === 'admin') {
      this.permissions = {
        canVerifyFaces: true,
        canManageUsers: true,
        canManageAllFaces: true,
        canViewAllData: true
      };
    } else if (this.role === 'manager') {
      this.permissions = {
        canVerifyFaces: true,
        canManageUsers: false,
        canManageAllFaces: true,
        canViewAllData: true
      };
    } else {
      this.permissions = {
        canVerifyFaces: false,
        canManageUsers: false,
        canManageAllFaces: false,
        canViewAllData: false
      };
    }
  }
  
  next();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      role: this.role,
      permissions: this.permissions 
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRE
    }
  );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);