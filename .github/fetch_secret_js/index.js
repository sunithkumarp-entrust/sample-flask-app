const core = require('@actions/core');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    // Get inputs
    const baseUrl = core.getInput('base_url', { required: true });
    const apiToken = core.getInput('api_token', { required: true });
    const boxId = core.getInput('box_id', { required: true });
    const secretId = core.getInput('secret_id', { required: true });
    const caCert = core.getInput('ca_cert');

    console.log(`Fetching secret: ${secretId} from box: ${boxId}`);
    
    // Start measuring time
    const startTime = Date.now();

    // Configure HTTPS agent with proper CA certificate handling
    let httpsAgent;
    
    if (caCert && caCert.trim() !== '') {
      console.log('CA certificate provided, configuring secure HTTPS agent');
      
      // Write the CA cert to a temporary file
      const tempCertPath = path.join(__dirname, 'temp-ca-cert.pem');
      fs.writeFileSync(tempCertPath, caCert);
      
      console.log(`CA certificate written to temporary file: ${tempCertPath}`);
      
      // Create HTTPS agent with the CA certificate
      httpsAgent = new https.Agent({
        ca: fs.readFileSync(tempCertPath),
        rejectUnauthorized: true // Enforce certificate validation with our trusted CA
      });
      
      console.log('HTTPS agent configured with provided CA certificate');
    } else {
      console.log('No CA certificate provided');
    }

    // Fetch secret from vault
    try {
      const requestConfig = {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      };
      
      // Only add the HTTPS agent if CA cert was provided
      if (httpsAgent) {
        requestConfig.httpsAgent = httpsAgent;
      }
      
      console.log(`Making request to ${baseUrl}/api/v1/secret/${boxId}/${secretId}`);
      const response = await axios.get(`${baseUrl}/api/v1/secret/${boxId}/${secretId}`, requestConfig);
      
      const secretValue = response.data.value || response.data.data;

      // Output the secret
      core.setOutput('secret', secretValue);
      
      const endTime = Date.now();
      console.log(`Secret fetched successfully in ${endTime - startTime}ms`);
    } catch (error) {
      console.error('Error details:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
      } else if (error.request) {
        console.error('Request was made but no response received');
      }
      throw new Error(`Failed to fetch secret: ${error.message}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
