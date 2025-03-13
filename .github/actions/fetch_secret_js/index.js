const core = require('@actions/core');
const axios = require('axios');
const https = require('https');

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

    // Create https agent with CA cert if provided
    let httpsAgent = undefined;
    if (caCert) {
      console.log('Using provided CA certificate');
      httpsAgent = new https.Agent({
        ca: caCert,
        rejectUnauthorized: true // Enforce SSL certificate validation
      });
      
      // Log certificate verification
      console.log('CA certificate configured for HTTPS requests');
    }

    // Fetch secret from vault
    try {
      const response = await axios.get(`${baseUrl}/api/v1/secret/${boxId}/${secretId}`, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: httpsAgent
      });
      
      const secretValue = response.data.value || response.data.data;

      // Output the secret
      core.setOutput('secret', secretValue);
      
      const endTime = Date.now();
      console.log(`Secret fetched successfully in ${endTime - startTime}ms`);
    } catch (error) {
      throw new Error(`Failed to fetch secret: ${error.message}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
