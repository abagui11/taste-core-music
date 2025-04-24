import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Spline from '@splinetool/react-spline';

function App() {
  //API base URL - use production URL unless we're in development
  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:5001`
    : 'https://taste-core-music.onrender.com';

  //forcing the API to use the production URL
  //const API_BASE_URL = 'https://taste-core-music.onrender.com'
    

  // State for all parameters
  const [parameters, setParameters] = useState({
    fresnel: 50,
    depthDarkTop: 50,
    depthDarkBottom: 50,
    red: 33,
    green: 33,
    blue: 33,
    noise: 30,
    displace: 50,
    speed: 50,
    normal: 20
  });

  // State for music parameters
  const [musicParams, setMusicParams] = useState({
    instrumentalness: 50,
    averageKey: 'C',
    popularity: 50,
    valence: 50,
    artistDiversity: 50,
    energy: 50,
    internalCoherence: 50
  });

  // State for server responses
  const [serverResponse, setServerResponse] = useState(null);
  const [speedEndpointStatus, setSpeedEndpointStatus] = useState({
    slow: false,
    medium: false,
    fast: false
  });

  // Modify user state to store more Spotify profile info
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  // Add a timestamp state for cache-busting
  const [timestamp, setTimestamp] = useState(Date.now());

  // Add new state for spline error handling
  const [splineError, setSplineError] = useState(null);
  const [isSplineLoading, setIsSplineLoading] = useState(true);
  const [viewerKey, setViewerKey] = useState(Date.now()); // Add a key state to force re-render

  // Add useEffect to load the spline-viewer script
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@splinetool/viewer@1.9.85/build/spline-viewer.js';
    script.onload = () => setIsSplineLoading(false);
    script.onerror = (error) => {
      console.error('Failed to load spline-viewer:', error);
      setSplineError(error);
      setIsSplineLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Fetch initial values when component mounts
  useEffect(() => {
    fetchValues();
    checkSpeedEndpoints();
    handleCallback(); // Check for Spotify callback
  }, []);

  const handleSpotifyLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/spotify`, {
        params: {
          scopes: [
            'user-read-private',
            'user-read-email',
            'playlist-read-private',
            'playlist-read-collaborative',
            'user-library-read'
          ].join(' ')
        }
      });
      window.location.href = response.data.url;
    } catch (err) {
      setError('Failed to initiate Spotify login');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const handleCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      setLoading(true);
      setError(null);
      
      // Clear the code from URL immediately to prevent reuse
      window.history.replaceState({}, document.title, window.location.pathname);
      
      try {
        const response = await axios.get(`${API_BASE_URL}/auth/spotify/callback?code=${code}`);
        const { access_token, refresh_token, profile, user_id, is_new_user } = response.data;
        
        setUser({
          id: user_id,
          accessToken: access_token,
          refreshToken: refresh_token,
          profile: profile
        });

        if (is_new_user) {
          setError('Save your taste profile by clicking the \'Save Profile\' button');
        } else {
          // Load user's saved parameters
          const savedParams = await axios.get(`${API_BASE_URL}/api/v1/values?user_id=${user_id}`);
          if (savedParams.data.status === 'success') {
            setParameters({
              fresnel: savedParams.data.data.fresnel || 50,
              depthDarkTop: savedParams.data.data.depth_dark_top || 50,
              depthDarkBottom: savedParams.data.data.depth_dark_bottom || 50,
              red: savedParams.data.data.red || 33,
              green: savedParams.data.data.green || 33,
              blue: savedParams.data.data.blue || 33,
              noise: savedParams.data.data.noise || 30,
              displace: savedParams.data.data.displace || 50,
              speed: savedParams.data.data.speed || 50,
              normal: savedParams.data.data.normal || 20
            });
            setTimestamp(Date.now());
          }
        }
      } catch (err) {
        console.error('Login error:', err);
        // If we get a 400 error with invalid_grant, try to check if user exists anyway
        if (err.response?.status === 400 && err.response?.data?.error === 'invalid_grant') {
          try {
            // Try to get the user's profile from our database
            const spotifyId = new URLSearchParams(window.location.search).get('state');
            if (spotifyId) {
              const userResponse = await axios.get(`${API_BASE_URL}/api/v1/user/${spotifyId}`);
              if (userResponse.data.status === 'success') {
                setUser({
                  id: userResponse.data.data.id,
                  profile: userResponse.data.data
                });
                // Load their saved parameters
                const savedParams = await axios.get(`${API_BASE_URL}/api/v1/values?user_id=${userResponse.data.data.id}`);
                if (savedParams.data.status === 'success') {
                  setParameters({
                    fresnel: savedParams.data.data.fresnel || 50,
                    depthDarkTop: savedParams.data.data.depth_dark_top || 50,
                    depthDarkBottom: savedParams.data.data.depth_dark_bottom || 50,
                    red: savedParams.data.data.red || 33,
                    green: savedParams.data.data.green || 33,
                    blue: savedParams.data.data.blue || 33,
                    noise: savedParams.data.data.noise || 30,
                    displace: savedParams.data.data.displace || 50,
                    speed: savedParams.data.data.speed || 50,
                    normal: savedParams.data.data.normal || 20
                  });
                  setTimestamp(Date.now());
                }
                return;
              }
            }
          } catch (dbErr) {
            console.error('Database check error:', dbErr);
          }
        }
        setError('Failed to find your profile');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    
    try {
      await axios.put(`${API_BASE_URL}/api/v1/update?user_id=${user.id}`, parameters);
      setError(null);
      alert('Settings saved successfully!');
    } catch (err) {
      setError('Failed to save settings');
      console.error(err);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/save-profile`, {
        spotify_id: user.profile.id,
        display_name: user.profile.display_name,
        email: user.profile.email,
        profile_image_url: user.profile.images?.[0]?.url,
        parameters: parameters
      });
      
      setError(null);
      alert('Profile saved successfully!');
    } catch (err) {
      setError('Failed to save profile');
      console.error(err);
    }
  };

  // Fetch values from server
  const fetchValues = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/spline/values`);
      setParameters({
        fresnel: response.data.fresnel,
        depthDarkTop: response.data.depthDarkTop,
        depthDarkBottom: response.data.depthDarkBottom,
        red: response.data.red,
        green: response.data.green,
        blue: response.data.blue,
        noise: response.data.noise,
        displace: response.data.displace,
        speed: response.data.speed,
        normal: response.data.normal
      });
      setServerResponse(response.data);
    } catch (error) {
      console.error("Error fetching values:", error);
    }
  };

  // Update parameters when slider changes
  const handleChange = (key, value) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Update music parameters when slider changes
  const handleMusicParamChange = (key, value) => {
    // Update musicParams state immediately for UI responsiveness
    setMusicParams(prev => ({
      ...prev,
      [key]: value
    }));

    // Direct mapping of instrumentalness to fresnel
    if (key === 'instrumentalness') {
      setParameters(prev => ({
        ...prev,
        fresnel: value
      }));
    }
    
    // Direct mapping of artist diversity to displacement
    if (key === 'artistDiversity') {
      setParameters(prev => ({
        ...prev,
        displace: value
      }));
    }
    
    // Direct mapping of energy to speed
    if (key === 'energy') {
      setParameters(prev => ({
        ...prev,
        speed: value
      }));
    }

    // Direct mapping of internal coherence to normal (scaled 0-100 to 0-30)
    if (key === 'internalCoherence') {
      setParameters(prev => ({
        ...prev,
        normal: Math.round((value / 100) * 30)
      }));
    }

    // Inverse non-linear mapping of valence to noise, darkBottom, and darkTop
    if (key === 'valence') {
      // Simple inverse mapping for noise
      const noiseValue = 100 - value;
      
      setParameters(prev => ({
        ...prev,
        noise: noiseValue,
        depthDarkBottom: noiseValue,
        depthDarkTop: noiseValue
      }));
    }

    // If average key changes, handle it specially
    if (key === 'averageKey') {
      // First, update the UI immediately
      const newRGB = calculateRGB();
      setParameters(prev => ({
        ...prev,
        red: newRGB.red,
        green: newRGB.green,
        blue: newRGB.blue
      }));

      // Then, after a short delay, update the server
      setTimeout(() => {
        const syntheticEvent = { preventDefault: () => {} };
        handleSubmit(syntheticEvent);
      }, 300); // Increased delay to 300ms
    }
  };

  // Calculate RGB values based on music parameters
  const calculateRGB = () => {
    const { valence, averageKey, popularity } = musicParams;
    
    // Ensure values are within bounds
    const boundedValence = Math.max(0, Math.min(100, valence));
    const boundedPopularity = Math.max(0, Math.min(100, popularity));
    
    // Calculate total RGB sum based on inverse valence (0-300)
    // Higher valence means lower RGB values
    const totalRGB = ((100 - boundedValence) / 100) * 300;
    
    // Base color distribution based on key
    const keyColors = {
      'A': { r: 0, g: 0, b: 100 },
      'A#': { r: 50, g: 0, b: 100 },
      'B': { r: 100, g: 0, b: 50 },
      'C': { r: 100, g: 0, b: 0 },
      'C#': { r: 100, g: 50, b: 0 },
      'D': { r: 100, g: 75, b: 0 },
      'D#': { r: 100, g: 100, b: 0 },
      'E': { r: 100, g: 100, b: 0 },
      'F': { r: 75, g: 100, b: 0 },
      'F#': { r: 0, g: 100, b: 0 },
      'G': { r: 0, g: 100, b: 75 },
      'G#': { r: 0, g: 0, b: 100 }
    };

    // Get base color for the key, default to C if key is invalid
    const baseColor = keyColors[averageKey] || keyColors['C'];
    
    // Calculate popularity factor (0-1)
    const popularityFactor = boundedPopularity / 100;
    
    // Calculate RGB values
    let r, g, b;
    
    try {
      if (popularityFactor === 1) {
        // If popularity is 100, all RGB values are equal
        const equalValue = totalRGB / 3;
        r = g = b = equalValue;
      } else {
        // Calculate base RGB values based on key color
        const baseSum = baseColor.r + baseColor.g + baseColor.b;
        const scaleFactor = totalRGB / baseSum;
        
        r = baseColor.r * scaleFactor;
        g = baseColor.g * scaleFactor;
        b = baseColor.b * scaleFactor;
        
        // Adjust spacing based on popularity
        const spacingFactor = 1 - popularityFactor;
        const maxDeviation = totalRGB * 0.3 * spacingFactor; // Maximum deviation from base values
        
        // Apply random deviation within maxDeviation
        r += (Math.random() * 2 - 1) * maxDeviation;
        g += (Math.random() * 2 - 1) * maxDeviation;
        b += (Math.random() * 2 - 1) * maxDeviation;
        
        // Ensure values stay within bounds and maintain total
        const currentSum = r + g + b;
        const correctionFactor = totalRGB / currentSum;
        r *= correctionFactor;
        g *= correctionFactor;
        b *= correctionFactor;
      }
      
      // Ensure final values are within bounds
      r = Math.max(0, Math.min(100, Math.round(r)));
      g = Math.max(0, Math.min(100, Math.round(g)));
      b = Math.max(0, Math.min(100, Math.round(b)));
      
      return { red: r, green: g, blue: b };
    } catch (error) {
      console.error('Error calculating RGB values:', error);
      // Return a safe default value
      return { red: 33, green: 33, blue: 33 };
    }
  };

  // Handle form submission - update server and fetch updated values
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Calculate new RGB values using the current musicParams
      const newRGB = calculateRGB();
      
      // Update parameters with new RGB values
      const updatedParameters = {
        ...parameters,
        red: newRGB.red,
        green: newRGB.green,
        blue: newRGB.blue
      };
      
      // Update all parameters with one request
      const url = user 
        ? `${API_BASE_URL}/spline/update?user_id=${user.id}`
        : `${API_BASE_URL}/spline/update`;
        
      await axios.put(url, updatedParameters);
      
      // Get updated values (includes calculated sphere values)
      const valuesUrl = user
        ? `${API_BASE_URL}/api/v1/values?user_id=${user.id}`
        : `${API_BASE_URL}/api/v1/values`;
      const response = await axios.get(valuesUrl);
      setServerResponse(response.data);
      console.log("Updated values:", response.data);
      
      // Test the speed endpoints
      checkSpeedEndpoints();
      
      // Force re-render of the viewer
      setViewerKey(Date.now());
      setTimestamp(Date.now());
    } catch (error) {
      console.error("Error updating values:", error);
    }
  };

  // Check all speed endpoints to show which one succeeds
  const checkSpeedEndpoints = async () => {
    const endpoints = ['slow', 'medium', 'fast'];
    const statuses = { slow: false, medium: false, fast: false };
    
    try {
      // First get the current speed value to ensure we're testing against the latest value
      const speedResponse = await axios.get(`${API_BASE_URL}/spline/speed`);
      console.log("Current speed value:", speedResponse.data.speedValue);
      
      // Test each endpoint
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${API_BASE_URL}/spline/${endpoint}`);
          statuses[endpoint] = response.data.success;
        } catch (error) {
          console.log(`${endpoint} endpoint failed:`, error.response?.data || error.message);
          statuses[endpoint] = false;
        }
      }
    } catch (error) {
      console.error("Error checking speed endpoints:", error);
    }
    
    setSpeedEndpointStatus(statuses);
  };

  // Add a useEffect to monitor timestamp changes
  useEffect(() => {
    console.log('Timestamp actually changed to:', timestamp);
  }, [timestamp]);

  const fetchUserPlaylists = async () => {
    if (!user?.accessToken) return;
    
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      setPlaylists(response.data.items);
    } catch (err) {
      console.error('Error fetching playlists:', err);
      setError('Failed to fetch playlists');
    }
  };

  // Add new function to fetch all tracks from a playlist
  const fetchPlaylistTracks = async (playlistId) => {
    if (!user?.accessToken) return [];
    
    try {
      const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      // Log the tracks for debugging
      console.log('Playlist tracks:', response.data.items.map(item => ({
        name: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        id: item.track.id
      })));
      
      return response.data.items.map(item => item.track);
    } catch (err) {
      console.error('Error fetching playlist tracks:', err.response?.data || err.message);
      setError('Failed to fetch playlist tracks');
      return [];
    }
  };

  // Add new function to fetch audio features for tracks
  const fetchAudioFeatures = async (trackIds) => {
    if (!user?.accessToken || trackIds.length === 0) return [];
    
    try {
      // Filter out any null or undefined track IDs
      const validTrackIds = trackIds.filter(id => id);
      
      if (validTrackIds.length === 0) {
        console.log('No valid track IDs to fetch features for');
        return [];
      }
      
      // Spotify API allows fetching up to 100 tracks at a time
      const chunks = [];
      for (let i = 0; i < validTrackIds.length; i += 100) {
        chunks.push(validTrackIds.slice(i, i + 100));
      }
      
      console.log(`Fetching audio features for ${validTrackIds.length} tracks in ${chunks.length} chunks`);
      
      const featuresPromises = chunks.map(async (chunk, index) => {
        try {
          // Add a small delay between chunks to avoid rate limiting
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const response = await axios.get(`${API_BASE_URL}/audio-features`, {
            params: {
              ids: chunk.join(',')
            },
            headers: {
              'Authorization': `Bearer ${user.accessToken}`
            }
          });
          
          if (!response.data) {
            console.error('Empty response from audio features API');
            return [];
          }
          
          // Extract instrumentalness from each track's features
          const features = response.data.audio_features || response.data.features || response.data;
          if (!Array.isArray(features)) {
            console.error('Unexpected response format:', response.data);
            return [];
          }
          
          return features
            .filter(feature => feature !== null)
            .map(feature => ({
              instrumentalness: feature.instrumentalness,
              trackId: feature.id
            }));
        } catch (err) {
          console.error(`Error fetching chunk ${index}:`, {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            headers: err.response?.headers,
            message: err.message
          });
          return [];
        }
      });
      
      const responses = await Promise.all(featuresPromises);
      const features = responses.flatMap(response => response);
      
      console.log(`Successfully fetched ${features.length} audio features`);
      return features;
    } catch (err) {
      console.error('Error in fetchAudioFeatures:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        headers: err.response?.headers,
        message: err.message
      });
      setError('Failed to fetch audio features. Please try again.');
      return [];
    }
  };

  // Add function to calculate average key
  const calculateAverageKey = (features) => {
    const keyCounts = new Array(12).fill(0);
    features.forEach(feature => {
      if (feature.key !== -1) { // -1 means no key detected
        keyCounts[feature.key]++;
      }
    });
    
    const maxCount = Math.max(...keyCounts);
    const mostCommonKey = keyCounts.indexOf(maxCount);
    
    const keyMap = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return keyMap[mostCommonKey];
  };

  // Add function to calculate artist diversity
  const calculateArtistDiversity = (tracks) => {
    const uniqueArtists = new Set();
    tracks.forEach(track => {
      track.artists.forEach(artist => uniqueArtists.add(artist.id));
    });
    return (uniqueArtists.size / tracks.length) * 100;
  };

  // Add new function to fetch track popularity
  const fetchTrackPopularity = async (trackId) => {
    if (!user?.accessToken || !trackId) return null;
    
    try {
      const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      return response.data.popularity;
    } catch (err) {
      console.error(`Error fetching popularity for track ${trackId}:`, err);
      return null;
    }
  };

  // Modify the useEffect that handles user access token
  useEffect(() => {
    if (user?.accessToken) {
      // Set the default Authorization header for all requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${user.accessToken}`;
      // Fetch playlists when user logs in
      fetchUserPlaylists();
    } else {
      // Remove the Authorization header when user logs out
      delete axios.defaults.headers.common['Authorization'];
      setPlaylists([]);
      setSelectedPlaylist(null);
    }
  }, [user, fetchUserPlaylists]);

  // Add new useEffect to handle playlist selection
  useEffect(() => {
    const updatePlaylistParameters = async () => {
      if (!selectedPlaylist || !user?.accessToken) return;
      
      try {
        // Fetch all tracks from the playlist
        const tracks = await fetchPlaylistTracks(selectedPlaylist.id);
        setPlaylistTracks(tracks);
        
        if (tracks.length === 0) return;
        
        // Get audio features for all tracks
        const trackIds = tracks.map(track => track.id);
        const features = await fetchAudioFeatures(trackIds);
        
        // Calculate average instrumentalness
        if (features.length > 0) {
          const totalInstrumentalness = features.reduce((sum, feature) => sum + feature.instrumentalness, 0);
          const averageInstrumentalness = Math.round((totalInstrumentalness / features.length) * 100);
          
          // Update music parameters with the calculated instrumentalness
          setMusicParams(prev => ({
            ...prev,
            instrumentalness: averageInstrumentalness
          }));
          
          console.log('Average instrumentalness:', averageInstrumentalness);
        }

        // Calculate average popularity
        const popularityPromises = tracks.map(track => fetchTrackPopularity(track.id));
        const popularities = await Promise.all(popularityPromises);
        const validPopularities = popularities.filter(pop => pop !== null);
        
        if (validPopularities.length > 0) {
          const averagePopularity = Math.round(
            validPopularities.reduce((sum, pop) => sum + pop, 0) / validPopularities.length
          );
          
          // Update music parameters with the calculated popularity
          setMusicParams(prev => ({
            ...prev,
            popularity: averagePopularity
          }));
          
          console.log('Average popularity:', averagePopularity);
        }

        // Calculate artist diversity
        const uniqueArtists = new Set();
        tracks.forEach(track => {
          track.artists.forEach(artist => uniqueArtists.add(artist.id));
        });
        
        const artistDiversity = Math.round((uniqueArtists.size / tracks.length) * 100);
        
        // Update music parameters with the calculated artist diversity
        setMusicParams(prev => ({
          ...prev,
          artistDiversity: artistDiversity
        }));
        
        console.log('Artist diversity:', artistDiversity);
        
      } catch (err) {
        console.error('Error updating playlist parameters:', err);
        setError('Failed to update playlist parameters');
      }
    };
    
    updatePlaylistParameters();
  }, [selectedPlaylist, user?.accessToken, fetchPlaylistTracks, fetchAudioFeatures, fetchTrackPopularity]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        
        
        {!user ? (
          <button
            onClick={handleSpotifyLogin}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1DB954',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Loading...' : 'Spotify Login'}
          </button>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            padding: '10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px'
          }}>
            {user.profile?.images?.[0]?.url && (
              <img 
                src={user.profile.images[0].url} 
                alt="" 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%' 
                }} 
              />
            )}
            <span>{user.profile?.display_name || 'Spotify User'}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '5px 10px',
                backgroundColor: '#282828',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          padding: '10px', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Playlist Selection Section */}
        {user && (
          <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
            <h2>Your Playlists</h2>
            <div style={{ marginBottom: '15px' }}>
              <select 
                value={selectedPlaylist?.id || ''}
                onChange={async (e) => {
                  const playlist = playlists.find(p => p.id === e.target.value);
                  setSelectedPlaylist(playlist);
                  // Create a synthetic event for handleSubmit
                  const syntheticEvent = { preventDefault: () => {} };
                  await handleSubmit(syntheticEvent);
                }}
                style={{ 
                  width: '100%', 
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  fontSize: '16px'
                }}
              >
                <option value="">Select a playlist</option>
                {playlists.map(playlist => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name} ({playlist.tracks.total} tracks)
                  </option>
                ))}
              </select>
            </div>
            {selectedPlaylist && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '15px',
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {selectedPlaylist.images?.[0]?.url && (
                    <img 
                      src={selectedPlaylist.images[0].url} 
                      alt={selectedPlaylist.name}
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '4px',
                        objectFit: 'cover'
                      }} 
                    />
                  )}
                  <div>
                    <h3 style={{ margin: '0 0 5px 0' }}>{selectedPlaylist.name}</h3>
                    <p style={{ margin: 0, color: '#666' }}>
                      {selectedPlaylist.tracks.total} tracks • By {selectedPlaylist.owner.display_name}
                    </p>
                  </div>
                </div>
                
                {/* Add analyzer link and playlist URL section */}
                <div style={{ 
                  marginTop: '10px',
                  padding: '15px',
                  backgroundColor: '#f8f8f8',
                  borderRadius: '4px',
                  border: '1px solid #eee'
                }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                    For instrumentalness, Average Key, Valence, and Energy use:{' '}
                    <a 
                      href="https://www.chosic.com/spotify-playlist-analyzer/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#1DB954', textDecoration: 'none' }}
                    >
                      Spotify Playlist Analyzer
                    </a>
                  </p>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    Link to your playlist:{' '}
                    <a 
                      href={selectedPlaylist.external_urls?.spotify} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#1DB954', textDecoration: 'none' }}
                    >
                      {selectedPlaylist.external_urls?.spotify}
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Music Parameters Section */}
        <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
          <h2>Playlist Qualities</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Instrumentalness: {musicParams.instrumentalness}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={musicParams.instrumentalness}
                  onChange={(e) => handleMusicParamChange('instrumentalness', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Average Key: {musicParams.averageKey}
                </label>
                <select 
                  value={musicParams.averageKey}
                  onChange={(e) => handleMusicParamChange('averageKey', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="A">A</option>
                  <option value="A#">A#</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="C#">C#</option>
                  <option value="D">D</option>
                  <option value="D#">D#</option>
                  <option value="E">E</option>
                  <option value="F">F</option>
                  <option value="F#">F#</option>
                  <option value="G">G</option>
                  <option value="G#">G#</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Popularity: {musicParams.popularity}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={musicParams.popularity}
                  onChange={(e) => handleMusicParamChange('popularity', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Valence: {musicParams.valence}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={musicParams.valence}
                  onChange={(e) => handleMusicParamChange('valence', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Artist Diversity: {musicParams.artistDiversity}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={musicParams.artistDiversity}
                  onChange={(e) => handleMusicParamChange('artistDiversity', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Energy: {musicParams.energy}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={musicParams.energy}
                  onChange={(e) => handleMusicParamChange('energy', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Internal Coherence: {musicParams.internalCoherence}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={musicParams.internalCoherence}
                  onChange={(e) => handleMusicParamChange('internalCoherence', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
          <button 
            type="submit" 
            style={{
              padding: '10px 20px', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              fontSize: '16px', 
              cursor: 'pointer'
            }}
          >
            Update
          </button>
          {user && (
            <button 
              type="button"
              onClick={handleSaveProfile}
              style={{
                padding: '10px 20px', 
                backgroundColor: '#2196F3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                fontSize: '16px', 
                cursor: 'pointer'
              }}
            >
              Save Profile
            </button>
          )}
        </div>
      </form>
      
      {/* Spline Scene with cache-busting */}
      <div style={{ 
        marginTop: '50px', 
        marginBottom: '30px', 
        height: 'min(575px, 80vh)', 
        borderRadius: '8px', 
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f5f5f5'
      }}>
        {isSplineLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#666',
            fontSize: '16px'
          }}>
            Loading 3D Model...
          </div>
        )}
        
        {splineError && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#c62828',
            fontSize: '16px',
            textAlign: 'center',
            padding: '20px'
          }}>
            Failed to load 3D Model. Please try refreshing the page.
            <br />
            <button 
              onClick={() => {
                setSplineError(null);
                setIsSplineLoading(true);
                setTimestamp(Date.now());
                setViewerKey(Date.now());
              }}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}
        
        <spline-viewer 
          key={viewerKey}
          url={`https://prod.spline.design/yLWSu17xSHhc09ZX/scene.splinecode?t=${timestamp}`}
          style={{
            width: '100%',
            height: '100%',
            display: isSplineLoading ? 'none' : 'block'
          }}
        />
      </div>
      
      {serverResponse && (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h2>Server Response</h2>
          
          {/* Speed Endpoint Status Section */}
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Speed Endpoint Status</h3>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  checkSpeedEndpoints();
                }}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Refresh Status
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ 
                flex: 1,
                padding: '15px', 
                borderRadius: '4px', 
                backgroundColor: speedEndpointStatus.slow ? '#4CAF50' : '#f8f8f8',
                color: speedEndpointStatus.slow ? 'white' : '#333',
                border: '1px solid #ddd',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Slow {speedEndpointStatus.slow ? '✓' : '✗'}
                <div style={{ fontSize: '12px', marginTop: '5px', fontWeight: 'normal' }}>
                  (Speed: 0-32)
                </div>
              </div>
              <div style={{ 
                flex: 1,
                padding: '15px', 
                borderRadius: '4px', 
                backgroundColor: speedEndpointStatus.medium ? '#4CAF50' : '#f8f8f8',
                color: speedEndpointStatus.medium ? 'white' : '#333',
                border: '1px solid #ddd',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Medium {speedEndpointStatus.medium ? '✓' : '✗'}
                <div style={{ fontSize: '12px', marginTop: '5px', fontWeight: 'normal' }}>
                  (Speed: 33-65)
                </div>
              </div>
              <div style={{ 
                flex: 1,
                padding: '15px', 
                borderRadius: '4px', 
                backgroundColor: speedEndpointStatus.fast ? '#4CAF50' : '#f8f8f8',
                color: speedEndpointStatus.fast ? 'white' : '#333',
                border: '1px solid #ddd',
                textAlign: 'center',
                fontWeight: 'bold'
              }}>
                Fast {speedEndpointStatus.fast ? '✓' : '✗'}
                <div style={{ fontSize: '12px', marginTop: '5px', fontWeight: 'normal' }}>
                  (Speed: 66-100)
                </div>
              </div>
            </div>
          </div>
          
          <pre style={{ backgroundColor: '#333', color: '#fff', padding: '15px', borderRadius: '4px', overflowX: 'auto' }}>
            {JSON.stringify(serverResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
