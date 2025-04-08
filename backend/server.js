const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory "database" for MVP. In production, use a real database.
let userData = {
  default: {
    fresnel: 50,
    depthDarkTop: 50,
    depthDarkBottom: 50,
    red: 33,
    green: 33,
    blue: 33,
    noise: 30,
    displace: 50,
    sphereLow: 0,
    sphereMid: 250,
    sphereHigh: 0,
    speed: 50,
    normal: 20
  }
};
let speedValue = 50; // Default speed value

// Calculate sphere values based on displacement
function calculateSphereValues(displace) {
  let sphereLow = 0;
  let sphereMid = 0;
  let sphereHigh = 0;
  
  if (displace >= 0 && displace < 33) {
    sphereLow = 250;
    sphereMid = 0;
    sphereHigh = 0;
  } else if (displace >= 33 && displace < 66) {
    sphereMid = 250;
    sphereLow = 0;
    sphereHigh = 0;
  } else {
    sphereHigh = 250;
    sphereLow = 0;
    sphereMid = 0;  
  }
  
  return { sphereLow, sphereMid, sphereHigh };
}

// API v1 endpoints
const apiV1Router = express.Router();

// API v1 GET endpoint to retrieve all parameters
apiV1Router.get('/values', (req, res) => {
  const userValues = userData.default || {};
  
  // Calculate sphere values based on displacement
  const { sphereLow, sphereMid, sphereHigh } = calculateSphereValues(userValues.displace);
  
  // Update the userData with calculated sphere values
  const updatedValues = {
    ...userValues,
    sphereLow,
    sphereMid,
    sphereHigh
  };
  
  // Update stored values
  userData.default = updatedValues;
  
  res.json({
    status: 'success',
    data: updatedValues
  });
});

// API v1 PUT endpoint to update parameters
apiV1Router.put('/update', (req, res) => {
  const newValues = req.body;
  
  // Validate inputs
  const validParams = ['fresnel', 'depthDarkTop', 'depthDarkBottom', 'red', 
                      'green', 'blue', 'noise', 'displace', 'speed', 'normal'];
  
  // Filter to only accept valid parameters
  const filteredValues = {};
  validParams.forEach(param => {
    if (newValues[param] !== undefined) {
      // Ensure values are within range (0-100)
      const value = Number(newValues[param]);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        filteredValues[param] = value;
      }
    }
  });
  
  // Update user data with validated values
  userData.default = { ...userData.default, ...filteredValues };
  
  // Calculate sphere values based on new displacement
  const { sphereLow, sphereMid, sphereHigh } = calculateSphereValues(userData.default.displace);
  
  // Update stored values with calculated sphere values
  userData.default = {
    ...userData.default,
    sphereLow,
    sphereMid,
    sphereHigh
  };
  
  // Update speed value
  if (filteredValues.speed !== undefined) {
    speedValue = filteredValues.speed;
  }
  
  res.json({
    status: 'success',
    data: userData.default
  });
});

// Mount the API v1 router
app.use('/api/v1', apiV1Router);

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error processing request: ${err.message}`);
  res.status(500).json({
    status: 'error',
    message: 'An internal server error occurred'
  });
});

// GET endpoint to retrieve parameters with calculated sphere values
app.get('/spline/values', (req, res) => {
  const userValues = userData.default || {};
  
  // Calculate sphere values based on displacement
  const { sphereLow, sphereMid, sphereHigh } = calculateSphereValues(userValues.displace);
  
  // Update the userData with calculated sphere values
  const updatedValues = {
    ...userValues,
    sphereLow,
    sphereMid,
    sphereHigh
  };
  
  // Update stored values
  userData.default = updatedValues;
  
  res.json(updatedValues);
});

// PUT endpoint to update parameters
app.put('/spline/update', (req, res) => {
  const newValues = req.body;
  
  // Update user data with new values
  userData.default = { ...userData.default, ...newValues };
  
  // Calculate sphere values based on new displacement
  const { sphereLow, sphereMid, sphereHigh } = calculateSphereValues(userData.default.displace);
  
  // Update stored values with calculated sphere values
  userData.default = {
    ...userData.default,
    sphereLow,
    sphereMid,
    sphereHigh
  };
  
  // Update speed value
  if (newValues.speed !== undefined) {
    speedValue = newValues.speed;
  }
  
  res.json(userData.default);
});

// Set speed value endpoint
app.put('/spline/speed', (req, res) => {
  const { value } = req.body;
  if (typeof value === 'number' && value >= 0 && value <= 100) {
    speedValue = value;
    
    // Update speed in userData as well
    if (userData.default) {
      userData.default.speed = value;
    }
    
    res.json({ success: true, speedValue });
  } else {
    res.status(400).json({ error: 'Invalid speed value' });
  }
});

// Get current speed value
app.get('/spline/speed', (req, res) => {
  res.json({ speedValue });
});

// Slow endpoint - succeeds if speedValue is 0-32
app.get('/spline/slow', (req, res) => {
  if (speedValue >= 0 && speedValue < 33) {
    res.json({ 
      success: true, 
      message: 'Slow endpoint succeeded',
      speedValue
    });
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Slow endpoint failed',
      speedValue
    });
  }
});

// Medium endpoint - succeeds if speedValue is 33-65
app.get('/spline/medium', (req, res) => {
  if (speedValue >= 33 && speedValue < 66) {
    res.json({ 
      success: true, 
      message: 'Medium endpoint succeeded',
      speedValue
    });
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Medium endpoint failed',
      speedValue
    });
  }
});

// Fast endpoint - succeeds if speedValue is 66-100
app.get('/spline/fast', (req, res) => {
  if (speedValue >= 66 && speedValue <= 100) {
    res.json({ 
      success: true, 
      message: 'Fast endpoint succeeded',
      speedValue
    });
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Fast endpoint failed',
      speedValue
    });
  }
});

const server = app.listen(port, () => {
  console.log(`Backend API listening on port ${port}`);
});

// Keep the server running by adding a reference to process
process.on('SIGINT', () => {
  console.log('Server shutting down');
  server.close();
  process.exit(0);
});

// Prevent the Node.js process from exiting immediately
setInterval(() => {
  // This empty interval keeps the event loop active
}, 1000 * 60 * 60);
