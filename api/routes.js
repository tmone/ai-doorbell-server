const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Import models
const Employee = require('../models/employeeModel');
const Visitor = require('../models/visitorModel');
const UnknownPerson = require('../models/unknownPersonModel');
const Face = require('../models/faceModel');
const ExtractedFace = require('../models/extractedFaceModel');
const User = require('../models/userModel');

// Import middleware
const { protect, authorize, checkPermission } = require('../utils/authMiddleware');
const helpers = require('../utils/helpers');

// Import face processing utilities
const faceProcessingBridge = require('../utils/faceProcessingBridge');

// Multer storage configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB file size limit
  fileFilter: (req, file, cb) => {
    // Check if the file is an image or video
    const allowedImageTypes = /jpeg|jpg|png|webp/;
    const allowedVideoTypes = /mp4|avi|mov|wmv|flv|mkv/;
    const mimetype = file.mimetype;
    
    // Check if it's an image
    if (mimetype.startsWith('image/') && allowedImageTypes.test(mimetype)) {
      req.fileType = 'image';
      return cb(null, true);
    }
    
    // Check if it's a video
    if (mimetype.startsWith('video/') && allowedVideoTypes.test(mimetype)) {
      req.fileType = 'video';
      return cb(null, true);
    }
    
    cb(new Error('Only image (JPEG, PNG, WebP) or video (MP4, AVI, MOV, etc.) files are supported!'));
  }
});

// ==== User Authentication Routes ====

// Register a new user
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });
    
    // Generate JWT token
    const token = user.getSignedJwtToken();
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

// Login user
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    
    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = user.getSignedJwtToken();
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// ==== Employee Routes ====

// Get all employees
router.get('/employees', async (req, res) => {
  try {
    const employees = await Employee.find().select('-attendance');
    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching employees',
      error: error.message
    });
  }
});

// Get single employee
router.get('/employees/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching employee',
      error: error.message
    });
  }
});

// Create employee with face registration
router.post('/employees', upload.array('faceImages', 5), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one face image'
      });
    }
    
    // Create a new Face entry with the primary image
    const primaryImage = req.files[0];
    const additionalImages = req.files.slice(1);
    
    // TODO: In a real implementation, call the face recognition model here
    // to extract facial features from the image
    const mockFaceFeatures = {
      vectors: [0.1, 0.2, 0.3, 0.4, 0.5], // Placeholder for actual face features
      landmarks: {
        eyes: { left: [100, 100], right: [150, 100] },
        nose: [125, 125],
        mouth: { left: [110, 150], right: [140, 150] }
      }
    };
    
    const face = new Face({
      primaryImage: {
        data: primaryImage.buffer,
        contentType: primaryImage.mimetype
      },
      additionalImages: additionalImages.map(img => ({
        data: img.buffer,
        contentType: img.mimetype,
        angle: 'front' // In production, would detect or get from form
      })),
      faceFeatures: mockFaceFeatures,
      featureVersion: '1.0', // Version of the face recognition model
      qualityScore: 0.95, // Placeholder score
      personType: 'employee',
      // Will be set after employee creation
    });
    
    // Create the employee
    const employee = new Employee({
      ...req.body,
      faceId: face._id
    });
    
    // Update the face with the employee ID
    face.personId = employee._id;
    
    // Save both documents
    await face.save({ session });
    await employee.save({ session });
    
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      data: employee
    });
  } catch (error) {
    await session.abortTransaction();
    
    res.status(500).json({
      success: false,
      message: 'Error creating employee',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Update employee
router.put('/employees/:id', async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating employee',
      error: error.message
    });
  }
});

// Delete employee
router.delete('/employees/:id', async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
    const employee = await Employee.findById(req.params.id).session(session);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Also delete associated face data
    await Face.findByIdAndDelete(employee.faceId).session(session);
    await employee.deleteOne({ session });
    
    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    
    res.status(500).json({
      success: false,
      message: 'Error deleting employee',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// ==== Visitor Routes ====

// Get all visitors
router.get('/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find();
    res.status(200).json({
      success: true,
      count: visitors.length,
      data: visitors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching visitors',
      error: error.message
    });
  }
});

// Create new visitor
router.post('/visitors', upload.array('faceImages', 5), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one face image'
      });
    }
    
    // Create a new Face entry with the primary image
    const primaryImage = req.files[0];
    const additionalImages = req.files.slice(1);
    
    // TODO: In a real implementation, call the face recognition model here
    const mockFaceFeatures = {
      vectors: [0.2, 0.3, 0.4, 0.5, 0.6], // Placeholder for actual face features
      landmarks: {
        eyes: { left: [100, 100], right: [150, 100] },
        nose: [125, 125],
        mouth: { left: [110, 150], right: [140, 150] }
      }
    };
    
    const face = new Face({
      primaryImage: {
        data: primaryImage.buffer,
        contentType: primaryImage.mimetype
      },
      additionalImages: additionalImages.map(img => ({
        data: img.buffer,
        contentType: img.mimetype,
        angle: 'front' // In production, would detect or get from form
      })),
      faceFeatures: mockFaceFeatures,
      featureVersion: '1.0', // Version of the face recognition model
      qualityScore: 0.95, // Placeholder score
      personType: 'visitor',
    });
    
    // Create the visitor with initial visit information
    const visitor = new Visitor({
      ...req.body,
      faceId: face._id,
      visits: [{
        entryTime: new Date(),
        purpose: req.body.purpose || 'General Visit',
        metWith: req.body.metWith || []
      }]
    });
    
    // Update the face with the visitor ID
    face.personId = visitor._id;
    
    // Save both documents
    await face.save({ session });
    await visitor.save({ session });
    
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      data: visitor
    });
  } catch (error) {
    await session.abortTransaction();
    
    res.status(500).json({
      success: false,
      message: 'Error creating visitor',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// ==== Unknown Person Routes ====

// Get all unknown persons detected by the system
router.get('/unknown-persons', async (req, res) => {
  try {
    const unknownPersons = await UnknownPerson.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: unknownPersons.length,
      data: unknownPersons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching unknown persons',
      error: error.message
    });
  }
});

// ==== Face Recognition Route ====

// Recognition endpoint - simulates real-time face recognition
router.post('/recognize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an image'
      });
    }
    
    // TODO: In a real implementation, call the face recognition model
    // For now we'll simulate by returning random results
    
    // Randomly determine if we recognize the face
    const recognized = Math.random() > 0.3; // 70% chance of recognition for demo purposes
    
    if (recognized) {
      // Randomly choose between employee and visitor
      const isEmployee = Math.random() > 0.5;
      
      if (isEmployee) {
        // Find a random employee to simulate recognition
        const employee = await Employee.findOne();
        
        if (employee) {
          return res.status(200).json({
            success: true,
            recognized: true,
            personType: 'employee',
            data: {
              id: employee._id,
              name: employee.name,
              employeeId: employee.employeeId,
              department: employee.department,
              confidence: 0.95
            }
          });
        }
      } else {
        // Find a random visitor to simulate recognition
        const visitor = await Visitor.findOne();
        
        if (visitor) {
          return res.status(200).json({
            success: true,
            recognized: true,
            personType: 'visitor',
            data: {
              id: visitor._id,
              name: visitor.name,
              company: visitor.company,
              regularVisitor: visitor.regularVisitor,
              confidence: 0.87
            }
          });
        }
      }
    }
    
    // If we didn't recognize anyone, create a new unknown person entry
    // TODO: In production, implement the actual face detection and feature extraction
    const mockFaceFeatures = {
      vectors: [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()],
      landmarks: {
        eyes: { left: [100, 100], right: [150, 100] },
        nose: [125, 125],
        mouth: { left: [110, 150], right: [140, 150] }
      }
    };
    
    const face = new Face({
      primaryImage: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      },
      faceFeatures: mockFaceFeatures,
      featureVersion: '1.0',
      qualityScore: 0.80,
      personType: 'unknown',
    });
    
    const unknownPerson = new UnknownPerson({
      faceId: face._id,
      detections: [{
        timestamp: new Date(),
        confidenceScore: 0.8,
        location: req.body.location || 'Main Entrance',
        deviceId: req.body.deviceId || 'device_1'
      }]
    });
    
    face.personId = unknownPerson._id;
    
    await face.save();
    await unknownPerson.save();
    
    res.status(200).json({
      success: true,
      recognized: false,
      message: 'Face not recognized. Created new unknown person entry.',
      data: {
        id: unknownPerson._id,
        threatLevel: unknownPerson.threatLevel
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing face recognition',
      error: error.message
    });
  }
});

// ==== NEW ROUTES FOR UPLOADS, LABELING AND VERIFICATION ====

// Upload face images for labeling
router.post('/faces/upload', protect, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one image'
      });
    }

    const results = [];

    // Process each uploaded image
    for (const file of req.files) {
      // Extract face features using the helper function
      const faceFeatures = await helpers.extractFaceFeatures(file.buffer);
      const qualityScore = await helpers.calculateFaceQuality(file.buffer);
      
      // Set initial personType as 'unknown'
      // This will be updated to employee or visitor after verification
      const face = new Face({
        primaryImage: {
          data: file.buffer,
          contentType: file.mimetype,
          uploadDate: new Date()
        },
        faceFeatures,
        featureVersion: '1.0', // Current version of the face recognition model
        qualityScore,
        personType: 'unknown',
        personId: new mongoose.Types.ObjectId(), // Temporary ID
        verificationStatus: 'unverified',
        uploadedBy: req.user._id,
        proposedLabels: [{
          label: req.body.proposedLabel || 'Unknown',
          proposedBy: req.user._id,
          proposedAt: new Date(),
          confidence: 1.0 // User's own label has full confidence
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Check for similar faces in the database
      const similarFaces = await helpers.findSimilarFaces(faceFeatures, 0.8);
      
      // If similar faces found, add them to the response
      const similarFacesInfo = similarFaces.map(match => ({
        faceId: match.face._id,
        personType: match.face.personType,
        verificationStatus: match.face.verificationStatus,
        similarity: match.similarity
      }));

      await face.save();
      
      // Log the activity
      helpers.logActivity(`User ${req.user.name} (${req.user._id}) uploaded a new face image with proposed label: ${req.body.proposedLabel || 'Unknown'}`);

      results.push({
        faceId: face._id,
        qualityScore,
        verificationStatus: 'unverified',
        similarFaces: similarFacesInfo
      });
    }

    res.status(201).json({
      success: true,
      message: `${results.length} face(s) uploaded successfully and pending verification`,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error uploading face image',
      error: error.message
    });
  }
});

// Get all faces for verification (admin/manager only)
router.get('/faces/pending-verification', 
  protect,
  checkPermission('canVerifyFaces'), 
  async (req, res) => {
    try {
      // Get filters from query params
      const { limit = 20, skip = 0, sortBy = 'createdAt', sortOrder = -1 } = req.query;
      
      // Build query
      const query = { verificationStatus: 'unverified' };
      
      // Get total count
      const total = await Face.countDocuments(query);
      
      // Get faces
      const faces = await Face.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .select('-faceFeatures')
        .populate('uploadedBy', 'name email')
        .populate('verifiedBy', 'name email');
      
      res.status(200).json({
        success: true,
        count: faces.length,
        total,
        data: faces
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching faces for verification',
        error: error.message
      });
    }
});

// Get all faces uploaded by the current user
router.get('/faces/my-uploads', protect, async (req, res) => {
  try {
    const faces = await Face.find({
      uploadedBy: req.user._id
    })
    .sort({ createdAt: -1 })
    .select('-faceFeatures')
    .populate('verifiedBy', 'name email');
    
    res.status(200).json({
      success: true,
      count: faces.length,
      data: faces
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching uploaded faces',
      error: error.message
    });
  }
});

// Propose a label for a face
router.post('/faces/:id/propose-label', protect, async (req, res) => {
  try {
    const { label } = req.body;
    
    if (!label) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a label'
      });
    }
    
    const face = await Face.findById(req.params.id);
    
    if (!face) {
      return res.status(404).json({
        success: false,
        message: 'Face not found'
      });
    }
    
    // Check if the user can access this face
    if (!helpers.canUserAccessFace(req.user, face) && !req.user.permissions.canVerifyFaces) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to propose a label for this face'
      });
    }
    
    // Check if the user has already proposed a label
    const existingProposal = face.proposedLabels.find(
      p => p.proposedBy.toString() === req.user._id.toString()
    );
    
    if (existingProposal) {
      // Update existing proposal
      existingProposal.label = label;
      existingProposal.proposedAt = new Date();
    } else {
      // Add new proposal
      face.proposedLabels.push({
        label,
        proposedBy: req.user._id,
        proposedAt: new Date(),
        confidence: 1.0
      });
    }
    
    face.updatedAt = new Date();
    await face.save();
    
    // Log the activity
    helpers.logActivity(`User ${req.user.name} (${req.user._id}) proposed label "${label}" for face ${face._id}`);
    
    res.status(200).json({
      success: true,
      message: 'Label proposed successfully',
      data: face
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error proposing label',
      error: error.message
    });
  }
});

// Verify a face (admin/manager only)
router.post('/faces/:id/verify', 
  protect,
  checkPermission('canVerifyFaces'), 
  async (req, res) => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      
      const { 
        status, 
        selectedLabel, 
        personType, 
        personId, 
        note,
        createNewPerson 
      } = req.body;
      
      if (!status || !(['verified', 'rejected'].includes(status))) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid verification status (verified or rejected)'
        });
      }
      
      const face = await Face.findById(req.params.id).session(session);
      
      if (!face) {
        return res.status(404).json({
          success: false,
          message: 'Face not found'
        });
      }
      
      face.verificationStatus = status;
      face.verifiedBy = req.user._id;
      face.verificationDate = new Date();
      face.verificationNote = note || '';
      face.updatedAt = new Date();
      
      if (status === 'verified') {
        if (!selectedLabel) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a selected label for verified faces'
          });
        }
        
        face.selectedLabel = selectedLabel;

        // Check if we need to create a new person or link to existing
        if (createNewPerson) {
          if (!personType || !(['employee', 'visitor'].includes(personType))) {
            return res.status(400).json({
              success: false,
              message: 'Please specify a valid person type (employee or visitor)'
            });
          }
          
          // Create a new person based on personType
          if (personType === 'employee') {
            const employee = new Employee({
              name: selectedLabel,
              employeeId: `EMP-${Date.now()}`,
              email: req.body.email || `${selectedLabel.replace(/\s+/g, '.').toLowerCase()}@example.com`,
              phone: req.body.phone || '0000000000',
              department: req.body.department || 'General',
              position: req.body.position || 'Staff',
              faceId: face._id,
              joiningDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await employee.save({ session });
            
            // Update the face with the new employee ID
            face.personType = 'employee';
            face.personId = employee._id;
          } else {
            // Create a new visitor
            const visitor = new Visitor({
              name: selectedLabel,
              email: req.body.email,
              phone: req.body.phone,
              company: req.body.company || 'Unknown',
              faceId: face._id,
              category: req.body.category || 'business',
              visits: [{
                entryTime: new Date(),
                purpose: req.body.purpose || 'General Visit',
              }],
              regularVisitor: req.body.regularVisitor || false,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await visitor.save({ session });
            
            // Update the face with the new visitor ID
            face.personType = 'visitor';
            face.personId = visitor._id;
          }
        } else if (personId) {
          // Link to existing person
          if (!personType || !(['employee', 'visitor'].includes(personType))) {
            return res.status(400).json({
              success: false,
              message: 'Please specify a valid person type (employee or visitor)'
            });
          }
          
          // Verify that the personId exists
          let person;
          if (personType === 'employee') {
            person = await Employee.findById(personId).session(session);
          } else {
            person = await Visitor.findById(personId).session(session);
          }
          
          if (!person) {
            return res.status(404).json({
              success: false,
              message: `${personType.charAt(0).toUpperCase() + personType.slice(1)} not found with ID ${personId}`
            });
          }
          
          face.personType = personType;
          face.personId = personId;
        }
      }
      
      await face.save({ session });
      
      // Log the activity
      helpers.logActivity(`User ${req.user.name} (${req.user._id}) ${status} face ${face._id} with label "${selectedLabel || 'none'}"`);
      
      await session.commitTransaction();
      
      res.status(200).json({
        success: true,
        message: `Face ${status} successfully`,
        data: face
      });
    } catch (error) {
      await session.abortTransaction();
      
      res.status(500).json({
        success: false,
        message: 'Error verifying face',
        error: error.message
      });
    } finally {
      session.endSession();
    }
});

// Get available labels (based on employees and visitors)
router.get('/labels', protect, async (req, res) => {
  try {
    // Get all employee names
    const employees = await Employee.find({ active: true })
      .select('name')
      .limit(1000);
    
    // Get all visitor names
    const visitors = await Visitor.find({ blacklisted: false })
      .select('name')
      .limit(1000);
    
    // Get labels created by the current user
    const user = await User.findById(req.user._id).select('createdLabels');
    
    // Combine all labels
    const employeeLabels = employees.map(emp => ({ 
      label: emp.name, 
      type: 'employee',
      id: emp._id 
    }));
    
    const visitorLabels = visitors.map(vis => ({ 
      label: vis.name, 
      type: 'visitor',
      id: vis._id  
    }));
    
    const userLabels = (user.createdLabels || []).map(label => ({
      label,
      type: 'custom',
      id: null
    }));
    
    // Combine and remove duplicates
    const allLabels = [...employeeLabels, ...visitorLabels, ...userLabels];
    const uniqueLabels = Array.from(new Map(allLabels.map(item => [item.label, item])).values());
    
    res.status(200).json({
      success: true,
      count: uniqueLabels.length,
      data: uniqueLabels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching labels',
      error: error.message
    });
  }
});

// Create a new label (save to user's created labels)
router.post('/labels', protect, async (req, res) => {
  try {
    const { label } = req.body;
    
    if (!label) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a label'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user.createdLabels) {
      user.createdLabels = [];
    }
    
    // Check if label already exists
    if (!user.createdLabels.includes(label)) {
      user.createdLabels.push(label);
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Label created successfully',
      data: user.createdLabels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating label',
      error: error.message
    });
  }
});

// ==== NEW ROUTES FOR FACE EXTRACTION FROM IMAGES AND VIDEOS ====

// Upload and extract faces from image/video
router.post('/faces/extract', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an image or video file'
      });
    }

    const { file } = req;
    const fileId = new mongoose.Types.ObjectId().toString();
    const sessionId = req.body.sessionId || fileId;
    
    // Create a new ExtractedFace document in "processing" state
    const extractedFace = new ExtractedFace({
      originalFile: {
        fileId,
        fileName: file.originalname,
        fileType: req.fileType
      },
      uploadedBy: req.user._id,
      status: 'processing',
      processingMessage: 'Extracting faces from uploaded file...',
      sessionId
    });
    
    await extractedFace.save();
    
    // Start face extraction in the background and send immediate response
    res.status(202).json({
      success: true,
      message: 'Face extraction started',
      extractionId: extractedFace._id,
      fileId,
      fileName: file.originalname,
      fileType: req.fileType,
      status: 'processing'
    });
    
    try {
      // Process the file in the background
      console.log(`Processing ${req.fileType} file: ${file.originalname}`);
      
      // Call the Python face processing bridge
      const result = await faceProcessingBridge.validateFaceUpload(file.buffer, req.fileType);
      
      if (!result.success) {
        // Update the document with failure information
        await ExtractedFace.findByIdAndUpdate(extractedFace._id, {
          status: 'failed',
          processingMessage: result.message || 'Failed to process the file'
        });
        return;
      }
      
      // Check if human faces were detected
      if (!result.is_valid || result.face_count === 0) {
        await ExtractedFace.findByIdAndUpdate(extractedFace._id, {
          status: 'failed',
          processingMessage: result.message || 'No human faces detected in the uploaded file'
        });
        return;
      }
      
      // Process the clusters
      const clusters = [];
      for (const [clusterId, clusterFaces] of Object.entries(result.clusters)) {
        // Get the first face as the representative face
        const representativeFace = clusterFaces.length > 0 ? {
          imageUrl: `face_${fileId}_${clusterId}_representative.jpg`,
          imageData: Buffer.from(clusterFaces[0].image, 'base64')
        } : null;
        
        // Process all faces in the cluster
        const faces = clusterFaces.map((face, index) => ({
          imageUrl: `face_${fileId}_${clusterId}_${index}.jpg`,
          imageData: Buffer.from(face.image, 'base64'),
          confidence: 1.0
        }));
        
        clusters.push({
          clusterId,
          representativeFace,
          faces,
          proposedLabels: []
        });
      }
      
      // Update the document with results
      await ExtractedFace.findByIdAndUpdate(extractedFace._id, {
        status: 'completed',
        processingMessage: `Successfully extracted ${result.face_count} faces from ${req.fileType}`,
        facesCount: result.face_count,
        clusters,
        updatedAt: new Date()
      });
      
      console.log(`Completed processing ${req.fileType} file: ${file.originalname}, extracted ${result.face_count} faces`);
    } catch (error) {
      console.error('Error processing uploaded file:', error);
      
      // Update the document with error information
      await ExtractedFace.findByIdAndUpdate(extractedFace._id, {
        status: 'failed',
        processingMessage: `Error processing file: ${error.message}`,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error in face extraction endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error extracting faces',
      error: error.message
    });
  }
});

// Get status of face extraction
router.get('/faces/extract/:id', protect, async (req, res) => {
  try {
    const extractedFace = await ExtractedFace.findById(req.params.id);
    
    if (!extractedFace) {
      return res.status(404).json({
        success: false,
        message: 'Face extraction not found'
      });
    }
    
    // Check if the user has permission to access this extraction
    if (extractedFace.uploadedBy.toString() !== req.user._id.toString() && 
        !req.user.permissions.canViewAllData && 
        req.user.role !== 'admin' && 
        req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this face extraction'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: extractedFace._id,
        fileId: extractedFace.originalFile.fileId,
        fileName: extractedFace.originalFile.fileName,
        fileType: extractedFace.originalFile.fileType,
        status: extractedFace.status,
        message: extractedFace.processingMessage,
        facesCount: extractedFace.facesCount,
        clusterCount: extractedFace.clusters ? extractedFace.clusters.length : 0,
        createdAt: extractedFace.createdAt,
        updatedAt: extractedFace.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching face extraction status',
      error: error.message
    });
  }
});

// Get face clusters for a specific extraction
router.get('/faces/extract/:id/clusters', protect, async (req, res) => {
  try {
    const extractedFace = await ExtractedFace.findById(req.params.id);
    
    if (!extractedFace) {
      return res.status(404).json({
        success: false,
        message: 'Face extraction not found'
      });
    }
    
    // Check if the user has permission to access this extraction
    if (extractedFace.uploadedBy.toString() !== req.user._id.toString() && 
        !req.user.permissions.canViewAllData && 
        req.user.role !== 'admin' && 
        req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access these face clusters'
      });
    }
    
    // Check status
    if (extractedFace.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Face extraction is not completed (status: ${extractedFace.status})`,
        status: extractedFace.status
      });
    }
    
    // Prepare clusters for response without sending the full image data
    const clusters = extractedFace.clusters.map(cluster => ({
      clusterId: cluster.clusterId,
      faces: cluster.faces.map(face => ({
        faceId: face._id,
        imageUrl: face.imageUrl
      })),
      representativeFace: cluster.representativeFace ? {
        imageUrl: cluster.representativeFace.imageUrl
      } : null,
      proposedLabels: cluster.proposedLabels,
      selectedLabel: cluster.selectedLabel,
      faceCount: cluster.faces.length
    }));
    
    res.status(200).json({
      success: true,
      data: {
        id: extractedFace._id,
        fileId: extractedFace.originalFile.fileId,
        fileName: extractedFace.originalFile.fileName,
        fileType: extractedFace.originalFile.fileType,
        clusters: clusters,
        facesCount: extractedFace.facesCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching face clusters',
      error: error.message
    });
  }
});

// Get a specific face image
router.get('/faces/extract/:id/face/:clusterId/:faceIndex', protect, async (req, res) => {
  try {
    const { id, clusterId, faceIndex } = req.params;
    
    const extractedFace = await ExtractedFace.findById(id);
    
    if (!extractedFace) {
      return res.status(404).json({
        success: false,
        message: 'Face extraction not found'
      });
    }
    
    // Check if the user has permission to access this extraction
    if (extractedFace.uploadedBy.toString() !== req.user._id.toString() && 
        !req.user.permissions.canViewAllData && 
        req.user.role !== 'admin' && 
        req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this face'
      });
    }
    
    // Find the cluster
    const cluster = extractedFace.clusters.find(c => c.clusterId === clusterId);
    
    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found'
      });
    }
    
    // Get the face
    const faceIdx = parseInt(faceIndex);
    if (isNaN(faceIdx) || faceIdx < 0 || faceIdx >= cluster.faces.length) {
      return res.status(404).json({
        success: false,
        message: 'Face not found'
      });
    }
    
    const face = cluster.faces[faceIdx];
    
    if (!face || !face.imageData) {
      return res.status(404).json({
        success: false,
        message: 'Face image data not found'
      });
    }
    
    // Set the content type and send the image data
    res.set('Content-Type', 'image/jpeg');
    res.send(face.imageData);
  } catch (error) {
    console.error('Error fetching face image:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching face image',
      error: error.message
    });
  }
});

// Label a face cluster
router.post('/faces/extract/:id/cluster/:clusterId/label', protect, async (req, res) => {
  try {
    const { id, clusterId } = req.params;
    const { label } = req.body;
    
    if (!label) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a label'
      });
    }
    
    const extractedFace = await ExtractedFace.findById(id);
    
    if (!extractedFace) {
      return res.status(404).json({
        success: false,
        message: 'Face extraction not found'
      });
    }
    
    // Check if the user has permission to access this extraction
    if (extractedFace.uploadedBy.toString() !== req.user._id.toString() && 
        !req.user.permissions.canViewAllData && 
        req.user.role !== 'admin' && 
        req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to label this cluster'
      });
    }
    
    // Find the cluster
    const clusterIndex = extractedFace.clusters.findIndex(c => c.clusterId === clusterId);
    
    if (clusterIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Cluster not found'
      });
    }
    
    // Check if the user has already proposed a label
    const existingLabelIndex = extractedFace.clusters[clusterIndex].proposedLabels.findIndex(
      p => p.proposedBy.toString() === req.user._id.toString()
    );
    
    // Update the proposed labels
    if (existingLabelIndex !== -1) {
      // Update existing label
      extractedFace.clusters[clusterIndex].proposedLabels[existingLabelIndex].label = label;
      extractedFace.clusters[clusterIndex].proposedLabels[existingLabelIndex].proposedAt = new Date();
    } else {
      // Add new label proposal
      extractedFace.clusters[clusterIndex].proposedLabels.push({
        label,
        proposedBy: req.user._id,
        proposedAt: new Date()
      });
    }
    
    // If user is admin or manager, also set as selected label
    if (req.user.role === 'admin' || req.user.role === 'manager' || req.user.permissions.canVerifyFaces) {
      extractedFace.clusters[clusterIndex].selectedLabel = label;
    }
    
    extractedFace.updatedAt = new Date();
    await extractedFace.save();
    
    res.status(200).json({
      success: true,
      message: 'Cluster labeled successfully',
      data: {
        clusterId,
        proposedLabels: extractedFace.clusters[clusterIndex].proposedLabels,
        selectedLabel: extractedFace.clusters[clusterIndex].selectedLabel
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error labeling cluster',
      error: error.message
    });
  }
});

// Complete the labeling process for an extraction
router.post('/faces/extract/:id/complete', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const extractedFace = await ExtractedFace.findById(id);
    
    if (!extractedFace) {
      return res.status(404).json({
        success: false,
        message: 'Face extraction not found'
      });
    }
    
    // Check if the user has permission to complete this labeling
    const canComplete = extractedFace.uploadedBy.toString() === req.user._id.toString() ||
                       req.user.role === 'admin' || 
                       req.user.role === 'manager' || 
                       req.user.permissions.canVerifyFaces;
                       
    if (!canComplete) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to complete this labeling'
      });
    }
    
    // Save selected labels to face collection for recognition
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      
      for (const cluster of extractedFace.clusters) {
        // Skip clusters with no selected label
        if (!cluster.selectedLabel) {
          continue;
        }
        
        // Get the representative face
        if (!cluster.representativeFace || !cluster.representativeFace.imageData) {
          continue;
        }
        
        // Create mock face features (in production would use real face recognition)
        const mockFaceFeatures = {
          vectors: Array.from({ length: 128 }, () => Math.random() * 2 - 1),
          landmarks: {
            eyes: { left: [100, 100], right: [150, 100] },
            nose: [125, 125],
            mouth: { left: [110, 150], right: [140, 150] }
          }
        };
        
        // Check if this label already exists in employees or visitors
        let personType = 'unknown';
        let personId = new mongoose.Types.ObjectId();
        
        // Try to find the person by name
        const employee = await Employee.findOne({ name: cluster.selectedLabel }).session(session);
        if (employee) {
          personType = 'employee';
          personId = employee._id;
        } else {
          const visitor = await Visitor.findOne({ name: cluster.selectedLabel }).session(session);
          if (visitor) {
            personType = 'visitor';
            personId = visitor._id;
          } else {
            // Create a new visitor if no matching person found
            const newVisitor = new Visitor({
              name: cluster.selectedLabel,
              faceId: new mongoose.Types.ObjectId(), // Will be updated later
              visits: [{
                entryTime: new Date(),
                purpose: 'Created from face extraction',
              }],
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await newVisitor.save({ session });
            personType = 'visitor';
            personId = newVisitor._id;
          }
        }
        
        // Create a new face record
        const face = new Face({
          primaryImage: {
            data: cluster.representativeFace.imageData,
            contentType: 'image/jpeg',
            uploadDate: new Date()
          },
          additionalImages: cluster.faces.slice(0, 4).map(face => ({
            data: face.imageData,
            contentType: 'image/jpeg',
            angle: 'front',
            uploadDate: new Date()
          })),
          faceFeatures: mockFaceFeatures,
          featureVersion: '1.0',
          qualityScore: 0.9,
          personType,
          personId,
          verificationStatus: req.user.permissions.canVerifyFaces ? 'verified' : 'unverified',
          uploadedBy: req.user._id,
          proposedLabels: [{
            label: cluster.selectedLabel,
            proposedBy: req.user._id,
            proposedAt: new Date(),
            confidence: 1.0
          }],
          selectedLabel: cluster.selectedLabel,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await face.save({ session });
        
        // If we created a new visitor, update its faceId
        if (personType === 'visitor' && !await Visitor.exists({ name: cluster.selectedLabel, faceId: { $ne: null } }).session(session)) {
          await Visitor.findByIdAndUpdate(personId, { faceId: face._id }, { session });
        }
      }
      
      // Mark extraction as labeled
      extractedFace.isLabeled = true;
      extractedFace.updatedAt = new Date();
      await extractedFace.save({ session });
      
      await session.commitTransaction();
      
      res.status(200).json({
        success: true,
        message: 'Face labeling completed successfully',
        data: {
          id: extractedFace._id,
          isLabeled: true
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error completing face labeling:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing face labeling',
      error: error.message
    });
  }
});

// Get all face extractions for current user
router.get('/faces/extractions', protect, async (req, res) => {
  try {
    const { limit = 20, skip = 0, status } = req.query;
    
    // Build the query
    const query = {
      uploadedBy: req.user._id
    };
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }
    
    // Administrators can see all extractions if specified
    if (req.query.all === 'true' && (req.user.role === 'admin' || req.user.role === 'manager')) {
      delete query.uploadedBy;
    }
    
    // Count total documents
    const totalCount = await ExtractedFace.countDocuments(query);
    
    // Get paginated results
    const extractions = await ExtractedFace.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .select('-clusters.faces.imageData -clusters.representativeFace.imageData');
    
    // Format for response
    const formattedExtractions = extractions.map(ext => ({
      id: ext._id,
      fileId: ext.originalFile.fileId,
      fileName: ext.originalFile.fileName,
      fileType: ext.originalFile.fileType,
      status: ext.status,
      message: ext.processingMessage,
      facesCount: ext.facesCount,
      clusterCount: ext.clusters ? ext.clusters.length : 0,
      isLabeled: ext.isLabeled,
      createdAt: ext.createdAt,
      updatedAt: ext.updatedAt
    }));
    
    res.status(200).json({
      success: true,
      count: extractions.length,
      total: totalCount,
      data: formattedExtractions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching face extractions',
      error: error.message
    });
  }
});

module.exports = router;