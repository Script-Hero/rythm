// Test the authentication integration
const API_BASE_URL = 'http://localhost:8000';

class TestApiService {
  constructor() {
    this.authToken = null;
  }

  async login(username, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.authToken = data.access_token;
    return data;
  }

  async testAuthenticatedRequest() {
    const response = await fetch(`${API_BASE_URL}/api/strategies/`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
}

// Test the authentication flow
async function testAuth() {
  const api = new TestApiService();
  
  console.log('🧪 Testing AlgoTrade Authentication...');
  
  try {
    // Step 1: Login with demo user
    console.log('1️⃣ Logging in with demo user...');
    const loginResult = await api.login('demo', 'demo123');
    console.log('✅ Login successful!');
    console.log(`   Token: ${loginResult.access_token.substring(0, 50)}...`);
    console.log(`   Expires in: ${loginResult.expires_in} seconds`);
    
    // Step 2: Test authenticated request
    console.log('\n2️⃣ Testing authenticated request to /api/strategies/...');
    const strategiesResult = await api.testAuthenticatedRequest();
    console.log('✅ Authenticated request successful!');
    console.log(`   Response: ${JSON.stringify(strategiesResult, null, 2)}`);
    
    console.log('\n🎉 Authentication is working correctly!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Demo user created: demo / demo123');
    console.log('   ✅ Login endpoint working');  
    console.log('   ✅ JWT tokens being issued');
    console.log('   ✅ Protected endpoints accepting tokens');
    console.log('   ✅ Frontend can now authenticate automatically');
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
  }
}

testAuth();