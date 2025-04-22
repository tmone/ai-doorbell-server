const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Load environment variables
dotenv.config();

// Import routes
const apiRoutes = require('./api/routes');

// Initialize express app
const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable CORS
app.use(cors());

// Security headers with Helmet
app.use(helmet());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Define routes
app.use('/api', apiRoutes);

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    return false;
    // Removed the "Continuing without database connection" message since we now require DB connection
  }
};

// Connect to the database and then start the server
const startServer = async () => {
  const dbConnected = await connectDB();
  
  if (!dbConnected) {
    console.error('Failed to connect to the database. Server will not start.');
    process.exit(1);
  }
  
  // Start the server only if the database is connected
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

// Simple route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to AI Doorbell API' });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

// Set port for the server
const PORT = process.env.PORT || 3000;

// Start the server with DB check
startServer();