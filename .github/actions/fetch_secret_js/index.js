const core = require('@actions/core');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function run() {
  let tempCertPath = null;
  
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
      console.log('Using provided CA certificate for self-signed certificate support');
      
      // Decode base64 certificate and write to temp file
      const certBuffer = Buffer.from(caCert, 'base64');
      tempCertPath = path.join(os.tmpdir(), `ca-cert-${Date.now()}.pem`);
      fs.writeFileSync(tempCertPath, certBuffer);
      console.log(`CA certificate written to temporary file: ${tempCertPath}`);
      
      httpsAgent = new https.Agent({
        ca: fs.readFileSync(tempCertPath)
      });
    } else {
      console.log('No CA certificate provided, using default certificate validation');
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
  } finally {
    // Clean up temp file if it was created
    if (tempCertPath && fs.existsSync(tempCertPath)) {
      try {
        fs.unlinkSync(tempCertPath);
        console.log('Temporary CA certificate file cleaned up');
      } catch (err) {
        console.error(`Failed to clean up temporary certificate file: ${err.message}`);
      }
    }
  }
}

run();
