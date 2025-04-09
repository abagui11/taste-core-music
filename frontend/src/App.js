import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Spline from '@splinetool/react-spline';

function App() {
  // API base URL - use production URL unless we're on localhost
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : 'https://taste-core-music.onrender.com';

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

  // State for server responses
  const [serverResponse, setServerResponse] = useState(null);
  const [speedEndpointStatus, setSpeedEndpointStatus] = useState({
    slow: false,
    medium: false,
    fast: false
  });

  // Add a timestamp state for cache-busting
  const [timestamp, setTimestamp] = useState(Date.now());

  // Fetch initial values when component mounts
  useEffect(() => {
    fetchValues();
    checkSpeedEndpoints(); // Also check speed endpoints on initial load
  }, []);

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

  // Handle form submission - update server and fetch updated values
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Update all parameters with one request
      await axios.put(`${API_BASE_URL}/spline/update`, parameters);
      
      // Get updated values (includes calculated sphere values)
      const response = await axios.get(`${API_BASE_URL}/spline/values`);
      setServerResponse(response.data);
      console.log("Updated values:", response.data);
      
      // Test the speed endpoints
      checkSpeedEndpoints();
      
      // Update timestamp to force Spline to reload
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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Spline Controls</h1>
      
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
            <h2>Visual Parameters</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Fresnel: {parameters.fresnel}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.fresnel}
                onChange={(e) => handleChange('fresnel', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Normal: {parameters.normal}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.normal}
                onChange={(e) => handleChange('normal', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Depth Dark Top: {parameters.depthDarkTop}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.depthDarkTop}
                onChange={(e) => handleChange('depthDarkTop', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Depth Dark Bottom: {parameters.depthDarkBottom}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.depthDarkBottom}
                onChange={(e) => handleChange('depthDarkBottom', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
            <h2>Color</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Red: {parameters.red}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.red}
                onChange={(e) => handleChange('red', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Green: {parameters.green}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.green}
                onChange={(e) => handleChange('green', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Blue: {parameters.blue}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.blue}
                onChange={(e) => handleChange('blue', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
            <h2>Effects</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Noise: {parameters.noise}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.noise}
                onChange={(e) => handleChange('noise', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Displace: {parameters.displace}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.displace}
                onChange={(e) => handleChange('displace', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              {serverResponse && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                  <div style={{ 
                    padding: '5px 10px', 
                    borderRadius: '4px', 
                    backgroundColor: serverResponse.sphereLow > 0 ? '#4CAF50' : '#ddd',
                    color: serverResponse.sphereLow > 0 ? 'white' : 'black',
                    opacity: serverResponse.sphereLow > 0 ? 1 : 0.5,
                    fontSize: '12px'
                  }}>
                    Low
                  </div>
                  <div style={{ 
                    padding: '5px 10px', 
                    borderRadius: '4px', 
                    backgroundColor: serverResponse.sphereMid > 0 ? '#4CAF50' : '#ddd',
                    color: serverResponse.sphereMid > 0 ? 'white' : 'black',
                    opacity: serverResponse.sphereMid > 0 ? 1 : 0.5,
                    fontSize: '12px'
                  }}>
                    Mid
                  </div>
                  <div style={{ 
                    padding: '5px 10px', 
                    borderRadius: '4px', 
                    backgroundColor: serverResponse.sphereHigh > 0 ? '#4CAF50' : '#ddd',
                    color: serverResponse.sphereHigh > 0 ? 'white' : 'black',
                    opacity: serverResponse.sphereHigh > 0 ? 1 : 0.5,
                    fontSize: '12px'
                  }}>
                    High
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Speed: {parameters.speed}
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={parameters.speed}
                onChange={(e) => handleChange('speed', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                <div style={{ 
                  padding: '5px 10px', 
                  borderRadius: '4px', 
                  backgroundColor: speedEndpointStatus.slow ? '#4CAF50' : '#ddd',
                  color: speedEndpointStatus.slow ? 'white' : 'black',
                  opacity: speedEndpointStatus.slow ? 1 : 0.5,
                  fontSize: '12px'
                }}>
                  Slow
                </div>
                <div style={{ 
                  padding: '5px 10px', 
                  borderRadius: '4px', 
                  backgroundColor: speedEndpointStatus.medium ? '#4CAF50' : '#ddd',
                  color: speedEndpointStatus.medium ? 'white' : 'black',
                  opacity: speedEndpointStatus.medium ? 1 : 0.5,
                  fontSize: '12px'
                }}>
                  Medium
                </div>
                <div style={{ 
                  padding: '5px 10px', 
                  borderRadius: '4px', 
                  backgroundColor: speedEndpointStatus.fast ? '#4CAF50' : '#ddd',
                  color: speedEndpointStatus.fast ? 'white' : 'black',
                  opacity: speedEndpointStatus.fast ? 1 : 0.5,
                  fontSize: '12px'
                }}>
                  Fast
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button 
          type="submit" 
          style={{
            display: 'block', 
            margin: '0 auto', 
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
      </form>
      
      {/* Spline Scene with cache-busting */}
      <div style={{ marginTop: '50px', marginBottom: '30px', height: '575px', borderRadius: '8px', overflow: 'hidden' }}>
        <Spline 
          scene={`https://prod.spline.design/yLWSu17xSHhc09ZX/scene.splinecode?t=${timestamp}`} 
          onError={() => {/* Silent error handler */}}
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
