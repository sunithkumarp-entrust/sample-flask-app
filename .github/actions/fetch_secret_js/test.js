// Mock dependencies before requiring any modules
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  exportVariable: jest.fn(),
  addPath: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}), { virtual: true });

jest.mock('axios');
jest.mock('fs');
jest.mock('path');

const axios = require('axios');
const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

// Save original implementation to restore later
const originalWriteFileSync = fs.writeFileSync;
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;
const originalUnlinkSync = fs.unlinkSync;

describe('Secret Fetcher', () => {
  beforeEach(() => {
    // Setup input mocks
    core.getInput.mockImplementation((name) => {
      const inputs = {
        'base_url': 'https://test-vault.example.com',
        'api_token': 'test-token',
        'box_id': 'test-box',
        'secret_id': 'test-secret',
        'ca_cert': 'base64encodedcert'
      };
      return inputs[name] || '';
    });
    
    // Reset mocks
    core.setOutput.mockReset();
    core.setFailed.mockReset();
    
    // Mock filesystem operations
    fs.writeFileSync = jest.fn();
    fs.readFileSync = jest.fn(() => 'certificate-content');
    fs.existsSync = jest.fn(() => true);
    fs.unlinkSync = jest.fn();
    
    // Mock path
    path.join = jest.fn(() => '/tmp/mock-cert.pem');
    
    // Reset and prepare axios mock
    axios.post = jest.fn().mockResolvedValue({
      data: {
        secret_data: 'test-secret-value'
      }
    });
    
    // Clear all console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    // Restore original implementations
    fs.writeFileSync = originalWriteFileSync;
    fs.readFileSync = originalReadFileSync;
    fs.existsSync = originalExistsSync;
    fs.unlinkSync = originalUnlinkSync;
  });

  test('should fetch secret successfully', async () => {
    // Import the module (this will execute the run function)
    jest.isolateModules(() => {
      require('./index.js');
    });
    
    // Wait for any promises to resolve
    await new Promise(process.nextTick);
    
    // Verify API was called correctly
    expect(axios.post).toHaveBeenCalledWith(
      'https://test-vault.example.com/vault/1.0/CheckoutSecret/', 
      {
        "box_id": "test-box",
        "secret_id": "test-secret"
      },
      {
        headers: {
          'X-Vault-Auth': 'test-token',
          'Content-Type': 'application/json'
        },
        httpsAgent: expect.anything(),
        timeout: 10000
      }
    );
    
    // Verify output was set
    expect(core.setOutput).toHaveBeenCalledWith('secret', 'test-secret-value');
    
    // Verify temp file was cleaned up
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/mock-cert.pem');
  });

  test('should handle API error', async () => {
    // Mock API to throw error
    axios.post.mockRejectedValueOnce(new Error('API Error'));
    
    // Import the module (this will execute the run function)
    jest.isolateModules(() => {
      require('./index.js');
    });
    
    // Wait for any promises to resolve
    await new Promise(process.nextTick);
    
    // Verify failure was reported
    expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch secret: API Error'));
  });

  test('should handle missing CA cert', async () => {
    // Mock no CA cert
    core.getInput.mockImplementation((name) => {
      const inputs = {
        'base_url': 'https://test-vault.example.com',
        'api_token': 'test-token',
        'box_id': 'test-box',
        'secret_id': 'test-secret',
      };
      return inputs[name] || '';
    });
    
    // Import the module (this will execute the run function)
    jest.isolateModules(() => {
      require('./index.js');
    });
    
    // Wait for any promises to resolve
    await new Promise(process.nextTick);
    
    // Verify no temp file operations occurred
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
