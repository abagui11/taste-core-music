require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const SpotifyWebApi = require('spotify-web-api-node');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5001;

// Initialize PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize Spotify client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Modify CORS to simpler version
app.use(cors({
  origin: '*', // Back to allowing all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add this function at the top with other utility functions
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
  
  return { 
    sphere_low: sphereLow,   // Match the snake_case used in the data
    sphere_mid: sphereMid,
    sphere_high: sphereHigh 
  };
}

// Modify the defaultUserData to use calculated values
const defaultUserData = {
  fresnel: 50,
  depth_dark_top: 50,
  depth_dark_bottom: 50,
  red: 33,
  green: 33,
  blue: 33,
  noise: 30,
  displace: 50,
  speed: 50,
  normal: 20,
  ...calculateSphereValues(50)  // Calculate default sphere values based on default displace
};

// Initialize temporaryValues with calculated sphere values
let temporaryValues = {...defaultUserData};

// Spotify Authentication Endpoints
app.get('/auth/spotify', (req, res) => {
  const scopes = [
    'user-read-email',
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-read-playback-state'
  ];
  const state = Math.random().toString(36).substring(7);
  
  // Generate the authorization URL with the correct redirect URI
  const authorizeURL = spotifyApi.createAuthorizeURL(
    scopes,
    state,
    // Don't show the dialog if the user is already authorized
    false
  );
  
  // Send the URL back to the client
  res.json({ url: authorizeURL });
});

app.get('/auth/spotify/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    // Exchange code for tokens
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    
    // Set the access token
    spotifyApi.setAccessToken(access_token);
    
    // Get user profile
    const me = await spotifyApi.getMe();
    
    // Check if user exists
    const userResult = await pool.query(
      'SELECT id FROM users WHERE spotify_id = $1',
      [me.body.id]
    );
    
    let userId;
    let is_new_user = false;
    
    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await pool.query(
        `INSERT INTO users (spotify_id, display_name, email, profile_image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [me.body.id, me.body.display_name, me.body.email, me.body.images?.[0]?.url]
      );
      userId = newUserResult.rows[0].id;
      is_new_user = true;
    } else {
      userId = userResult.rows[0].id;
      
      // Update existing user's profile
      await pool.query(
        `UPDATE users 
         SET display_name = $1, email = $2, profile_image_url = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [me.body.display_name, me.body.email, me.body.images?.[0]?.url, userId]
      );
    }
    
    // Send back tokens, profile info, and user ID
    res.json({
      access_token,
      refresh_token,
      profile: me.body,
      user_id: userId,
      is_new_user
    });
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message
    });
  }
});

// API v1 endpoints
const apiV1Router = express.Router();

// API v1 GET endpoint to retrieve all parameters
apiV1Router.get('/values', async (req, res, next) => {
  const userId = req.query.user_id;
  
  if (!userId) {
    console.log('No user ID provided, using temporary values');
    const sphereValues = calculateSphereValues(temporaryValues.displace);
    res.json({
      status: 'success',
      data: {
        ...temporaryValues,
        ...sphereValues
      }
    });
    next();
    return;
  }
  
  try {
    const userResult = await pool.query(
      'SELECT * FROM user_data WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`User data not found for user ID: ${userId}, using default values`);
      const sphereValues = calculateSphereValues(defaultUserData.displace);
      res.json({
        status: 'success',
        data: {
          ...defaultUserData,
          ...sphereValues
        }
      });
      next();
      return;
    }
    
    console.log(`Found user data for user ID: ${userId}`);
    const userData = userResult.rows[0];
    const sphereValues = calculateSphereValues(userData.displace || defaultUserData.displace);
    
    // Handle null values by using defaults
    const data = {
      fresnel: userData.fresnel ?? defaultUserData.fresnel,
      depth_dark_top: userData.depth_dark_top ?? defaultUserData.depth_dark_top,
      depth_dark_bottom: userData.depth_dark_bottom ?? defaultUserData.depth_dark_bottom,
      red: userData.red ?? defaultUserData.red,
      green: userData.green ?? defaultUserData.green,
      blue: userData.blue ?? defaultUserData.blue,
      noise: userData.noise ?? defaultUserData.noise,
      displace: userData.displace ?? defaultUserData.displace,
      speed: userData.speed ?? defaultUserData.speed,
      normal: userData.normal ?? defaultUserData.normal,
      ...sphereValues
    };

    // Update temporaryValues with the user's data
    temporaryValues = {
      fresnel: data.fresnel,
      depth_dark_top: data.depth_dark_top,
      depth_dark_bottom: data.depth_dark_bottom,
      red: data.red,
      green: data.green,
      blue: data.blue,
      noise: data.noise,
      displace: data.displace,
      speed: data.speed,
      normal: data.normal
    };
    
    console.log('Updated temporary values to:', temporaryValues);
    console.log('Data object being sent:', data);
    
    res.json({
      status: 'success',
      data
    });
    next();
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
    next(error);
  }
});

// API v1 PUT endpoint to update parameters
apiV1Router.put('/update', async (req, res) => {
  const userId = req.query.user_id;
  const newValues = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  try {
    // Validate inputs
    const validParams = ['fresnel', 'depth_dark_top', 'depth_dark_bottom', 'red', 
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
    
    // Update user data in PostgreSQL
    const updateResult = await pool.query(
      'UPDATE user_data SET fresnel = $1, depth_dark_top = $2, depth_dark_bottom = $3, red = $4, green = $5, blue = $6, noise = $7, displace = $8, speed = $9, normal = $10 WHERE user_id = $11',
      [
        filteredValues.fresnel,
        filteredValues.depth_dark_top,
        filteredValues.depth_dark_bottom,
        filteredValues.red,
        filteredValues.green,
        filteredValues.blue,
        filteredValues.noise,
        filteredValues.displace,
        filteredValues.speed,
        filteredValues.normal,
        userId
      ]
    );
    
    if (updateResult.rowCount === 0) {
      throw new Error('User data not found');
    }
    
    res.json({
      status: 'success',
      data: filteredValues
    });
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ error: 'Failed to update user data' });
  }
});

// API v1 POST endpoint to save user profile
apiV1Router.post('/save-profile', async (req, res) => {
  const { spotify_id, display_name, email, profile_image_url, parameters } = req.body;
  
  if (!spotify_id) {
    return res.status(400).json({ error: 'Spotify ID is required' });
  }
  
  try {
    // First, check if user exists
    const userResult = await pool.query(
      'SELECT id FROM users WHERE spotify_id = $1',
      [spotify_id]
    );
    
    let userId;
    
    if (userResult.rows.length === 0) {
      // User doesn't exist, create new user
      const newUserResult = await pool.query(
        `INSERT INTO users (spotify_id, display_name, email, profile_image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [spotify_id, display_name, email, profile_image_url]
      );
      userId = newUserResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
      
      // Update existing user's profile
      await pool.query(
        `UPDATE users 
         SET display_name = $1, email = $2, profile_image_url = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [display_name, email, profile_image_url, userId]
      );
    }
    
    // Check if user_data exists
    const dataResult = await pool.query(
      'SELECT id FROM user_data WHERE user_id = $1',
      [userId]
    );
    
    const sphereValues = calculateSphereValues(parameters.displace);
    
    if (dataResult.rows.length === 0) {
      // Create new user_data entry
      await pool.query(
        `INSERT INTO user_data (user_id, fresnel, depth_dark_top, depth_dark_bottom, 
         red, green, blue, noise, displace, speed, normal, sphere_low, sphere_mid, sphere_high)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          userId,
          parameters.fresnel,
          parameters.depthDarkTop,
          parameters.depthDarkBottom,
          parameters.red,
          parameters.green,
          parameters.blue,
          parameters.noise,
          parameters.displace,
          parameters.speed,
          parameters.normal,
          sphereValues.sphere_low,
          sphereValues.sphere_mid,
          sphereValues.sphere_high
        ]
      );
    } else {
      // Update existing user_data
      await pool.query(
        `UPDATE user_data 
         SET fresnel = $1, depth_dark_top = $2, depth_dark_bottom = $3,
             red = $4, green = $5, blue = $6, noise = $7, displace = $8,
             speed = $9, normal = $10, sphere_low = $11, sphere_mid = $12, sphere_high = $13,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $14`,
        [
          parameters.fresnel,
          parameters.depthDarkTop,
          parameters.depthDarkBottom,
          parameters.red,
          parameters.green,
          parameters.blue,
          parameters.noise,
          parameters.displace,
          parameters.speed,
          parameters.normal,
          sphereValues.sphere_low,
          sphereValues.sphere_mid,
          sphereValues.sphere_high,
          userId
        ]
      );
    }
    
    res.json({
      status: 'success',
      message: 'Profile saved successfully',
      user_id: userId
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// API v1 GET endpoint to get user by Spotify ID
apiV1Router.get('/user/:spotifyId', async (req, res) => {
  const { spotifyId } = req.params;
  
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE spotify_id = $1',
      [spotifyId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.json({
      status: 'success',
      data: userResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
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
app.get('/spline/values', async (req, res) => {
  const userId = req.query.user_id;
  
  if (!userId) {
    const sphereValues = calculateSphereValues(temporaryValues.displace);
    return res.json({...temporaryValues, ...sphereValues});
  }
  
  try {
    const userResult = await pool.query(
      'SELECT * FROM user_data WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      const sphereValues = calculateSphereValues(temporaryValues.displace);
      return res.json({...temporaryValues, ...sphereValues});
    }
    
    const userData = userResult.rows[0];
    const sphereValues = calculateSphereValues(userData.displace);
    res.json({...userData, ...sphereValues});
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// PUT endpoint to update parameters
app.put('/spline/update', async (req, res) => {
  const newValues = req.body;
  
  try {
    if (req.query.user_id) {
      const updateResult = await pool.query(
        'UPDATE user_data SET fresnel = $1, depth_dark_top = $2, depth_dark_bottom = $3, red = $4, green = $5, blue = $6, noise = $7, displace = $8, speed = $9, normal = $10 WHERE user_id = $11',
        [
          newValues.fresnel,
          newValues.depth_dark_top,
          newValues.depth_dark_bottom,
          newValues.red,
          newValues.green,
          newValues.blue,
          newValues.noise,
          newValues.displace,
          newValues.speed,
          newValues.normal,
          req.query.user_id
        ]
      );
      
      if (updateResult.rowCount === 0) {
        throw new Error('User data not found');
      }
      
      const userResult = await pool.query(
        'SELECT * FROM user_data WHERE user_id = $1',
        [req.query.user_id]
      );
      
      const userData = userResult.rows[0];
      const sphereValues = calculateSphereValues(userData.displace);
      res.json({...userData, ...sphereValues});
    } else {
      // Update temporary values
      temporaryValues = {...temporaryValues, ...newValues};
      // Calculate sphere values based on new displacement
      const sphereValues = calculateSphereValues(temporaryValues.displace);
      res.json({...temporaryValues, ...sphereValues});
    }
  } catch (error) {
    console.error('Error updating values:', error);
    res.status(500).json({ error: 'Failed to update values' });
  }
});

// Set speed value endpoint
app.put('/spline/speed', async (req, res) => {
  const userId = req.query.user_id;
  const { value } = req.body;
  
  if (typeof value !== 'number' || value < 0 || value > 100) {
    return res.status(400).json({ error: 'Invalid speed value' });
  }
  
  try {
    if (userId) {
      const updateResult = await pool.query(
        'UPDATE user_data SET speed = $1 WHERE user_id = $2',
        [value, userId]
      );
      
      if (updateResult.rowCount === 0) {
        throw new Error('User data not found');
      }
      
      const userResult = await pool.query(
        'SELECT speed FROM user_data WHERE user_id = $1',
        [userId]
      );
      
      const userData = userResult.rows[0];
      res.json({ success: true, speedValue: userData.speed });
    } else {
      // Update temporary speed value
      temporaryValues.speed = value;
      res.json({ success: true, speedValue: value });
    }
  } catch (error) {
    console.error('Error updating speed:', error);
    res.status(500).json({ error: 'Failed to update speed' });
  }
});

// Get current speed value
app.get('/spline/speed', async (req, res) => {
  const userId = req.query.user_id;
  
  if (!userId) {
    return res.json({ speedValue: temporaryValues.speed });  // Return temporary speed
  }
  
  try {
    const userResult = await pool.query(
      'SELECT speed FROM user_data WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      // If no user data found, return default speed
      return res.json({ speedValue: temporaryValues.speed });
    }
    
    const userData = userResult.rows[0];
    res.json({ speedValue: userData.speed });
  } catch (error) {
    console.error('Error fetching speed:', error);
    res.status(500).json({ error: 'Failed to fetch speed' });
  }
});

// Slow endpoint - succeeds if speedValue is 0-32
app.get('/spline/slow', async (req, res) => {
  const userId = req.query.user_id;
  let speedValue;
  
  if (!userId) {
    speedValue = temporaryValues.speed;  // Use temporary speed
  } else {
    try {
      const userResult = await pool.query(
        'SELECT speed FROM user_data WHERE user_id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        // If no user data found, use default speed
        speedValue = temporaryValues.speed;
      } else {
        speedValue = userResult.rows[0].speed;
      }
    } catch (error) {
      console.error('Error checking slow speed:', error);
      return res.status(500).json({ error: 'Failed to check speed' });
    }
  }
  
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
app.get('/spline/medium', async (req, res) => {
  const userId = req.query.user_id;
  let speedValue;
  
  if (!userId) {
    speedValue = temporaryValues.speed;  // Use temporary speed
  } else {
    try {
      const userResult = await pool.query(
        'SELECT speed FROM user_data WHERE user_id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        // If no user data found, use default speed
        speedValue = temporaryValues.speed;
      } else {
        speedValue = userResult.rows[0].speed;
      }
    } catch (error) {
      console.error('Error checking medium speed:', error);
      return res.status(500).json({ error: 'Failed to check speed' });
    }
  }
  
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
app.get('/spline/fast', async (req, res) => {
  const userId = req.query.user_id;
  let speedValue;
  
  if (!userId) {
    speedValue = temporaryValues.speed;  // Use temporary speed
  } else {
    try {
      const userResult = await pool.query(
        'SELECT speed FROM user_data WHERE user_id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        if (error.code === 'PGRST116') {
          speedValue = temporaryValues.speed;  // Use temporary speed as fallback
        } else {
          throw error;
        }
      } else {
        speedValue = userResult.rows[0].speed;
      }
    } catch (error) {
      console.error('Error checking fast speed:', error);
      return res.status(500).json({ error: 'Failed to check speed' });
    }
  }
  
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

// Add this middleware to log all incoming requests
app.use((req, res, next) => {
  console.log('Incoming request:', {
    path: req.path,
    query: req.query,
    headers: req.headers
  });
  next();
});

// Add new endpoint to proxy audio features requests
app.get('/api/v1/audio-features', async (req, res) => {
  const { ids } = req.query;
  
  if (!ids) {
    return res.status(400).json({ error: 'Track IDs are required' });
  }

  // Extract the access token from the Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }
  const accessToken = authHeader.split(' ')[1];
  
  try {
    const response = await axios.get(`https://api.spotify.com/v1/audio-features`, {
      params: { ids },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching audio features:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch audio features',
      details: error.response?.data || error.message
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
