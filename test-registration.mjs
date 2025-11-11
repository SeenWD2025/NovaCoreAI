import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const testRegistration = async () => {
  try {
    console.log('Testing registration at:', `${API_URL}/auth/register`);
    
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: `test-${Date.now()}@example.com`,
      password: 'testpass123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Registration successful!');
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
    // Check the token format
    const tokens = {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token
    };
    
    console.log('Token formats:', tokens);
    
  } catch (error) {
    console.error('Registration failed!');
    if (axios.isAxiosError(error)) {
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.response?.data);
      console.error('Error headers:', error.response?.headers);
    } else {
      console.error('Unknown error:', error);
    }
  }
};

testRegistration();