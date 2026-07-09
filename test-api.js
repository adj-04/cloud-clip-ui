#!/usr/bin/env node
/**
 * Quick API Test Script
 * Tests the connection to AWS backend
 * 
 * Usage:
 *   node test-api.js
 * 
 * Reads API_URL from .env.local file
 */

const fs = require('fs');
const path = require('path');

// Read API URL from .env.local
function loadEnvVar() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_API_URL=(.+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    console.error('❌ Could not read .env.local file');
    console.error('   Make sure .env.local exists with NEXT_PUBLIC_API_URL');
    process.exit(1);
  }
}

const API_URL = loadEnvVar();
const FRONTEND_URL = process.env.CODESPACE_NAME 
  ? `https://${process.env.CODESPACE_NAME}-3000.app.github.dev`
  : 'http://localhost:3000';
const TEST_ROOM = 'test-room-' + Date.now();

if (!API_URL) {
  console.error('❌ NEXT_PUBLIC_API_URL not found in .env.local');
  process.exit(1);
}

console.log('🧪 Testing Cloud Clip API\n');
console.log('API URL:', API_URL);
console.log('Frontend URL:', FRONTEND_URL);
console.log('Test Room:', TEST_ROOM);
console.log('━'.repeat(60));

async function testAPI() {
  try {
    // Test 1: Create/Update a clip
    console.log('\n📝 Test 1: Saving text to room...');
    const saveResponse = await fetch(`${API_URL}/clip/${TEST_ROOM}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello from test script!' })
    });
    
    if (saveResponse.ok) {
      const saveData = await saveResponse.json();
      console.log('✅ Save successful:', saveData);
    } else {
      console.log('❌ Save failed:', saveResponse.status, saveResponse.statusText);
      const errorText = await saveResponse.text();
      console.log('   Error:', errorText);
    }

    // Test 2: Retrieve the clip
    console.log('\n📖 Test 2: Fetching text from room...');
    const getResponse = await fetch(`${API_URL}/clip/${TEST_ROOM}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log('✅ Fetch successful:', getData);
      console.log('   Text matches:', getData.text === 'Hello from test script!');
    } else {
      console.log('❌ Fetch failed:', getResponse.status, getResponse.statusText);
      const errorText = await getResponse.text();
      console.log('   Error:', errorText);
    }

    // Test 3: Get upload URL
    console.log('\n📤 Test 3: Getting presigned upload URL...');
    const uploadUrlResponse = await fetch(`${API_URL}/clip/${TEST_ROOM}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fileName: 'test-file.txt',
        fileType: 'text/plain'
      })
    });
    
    if (uploadUrlResponse.ok) {
      const uploadData = await uploadUrlResponse.json();
      console.log('✅ Upload URL received');
      console.log('   Key:', uploadData.key);
      console.log('   URL:', uploadData.uploadUrl.substring(0, 50) + '...');
    } else {
      console.log('❌ Upload URL failed:', uploadUrlResponse.status, uploadUrlResponse.statusText);
      const errorText = await uploadUrlResponse.text();
      console.log('   Error:', errorText);
    }

    console.log('\n' + '━'.repeat(60));
    console.log('✨ API tests completed!');
    console.log('\n🌐 Open your browser to:', FRONTEND_URL);
    console.log('🎯 Try this room:', FRONTEND_URL + '/clip/' + TEST_ROOM);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('\n⚠️  Possible issues:');
    console.error('   - AWS backend not deployed');
    console.error('   - CORS not configured');
    console.error('   - Network connectivity');
    console.error('   - Invalid API Gateway URL');
  }
}

testAPI();
