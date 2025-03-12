import os
import requests
import base64
import tempfile

# Define API endpoint constant
CHECKOUT_SECRET_API = "/vault/1.0/CheckoutSecret/"

class VaultClient:
    def __init__(self, baseurl, api_token, ca_cert=None):
        self.baseurl = baseurl
        self.api_token = api_token
        self.ca_cert = self._process_ca_cert(ca_cert)

    def _process_ca_cert(self, ca_cert):
        """Process CA certificate which might be base64 encoded."""
        if not ca_cert:
            return None

        # Check if it looks like base64 (no file path, no "False")
        if isinstance(ca_cert, str) and not os.path.exists(ca_cert) and ca_cert != "False":
            try:
                # Try to decode the base64 string
                cert_data = base64.b64decode(ca_cert)
                
                # Create a temporary file to store the certificate
                cert_file = tempfile.NamedTemporaryFile(delete=False)
                cert_file.write(cert_data)
                cert_file.close()
                
                # Return the path to the temporary file
                return cert_file.name
            except Exception as e:
                print(f"Error processing CA certificate: {e}")
                return None
        
        # If it's "False", return False to disable verification
        if ca_cert == "False":
            return False
            
        # Otherwise return as is (could be a path or True)
        return ca_cert

    def checkout_secret(self, box_id, secret_id):
        headers = {
            'X-Vault-Auth': self.api_token,
            'Content-Type': 'application/json'
        }
        data = {
            "box_id": box_id,
            "secret_id": secret_id
        }
        api_url = self.baseurl + CHECKOUT_SECRET_API
        response = requests.post(api_url, headers=headers, json=data, verify=self.ca_cert)
        response.raise_for_status()
        
        # Clean up the temporary CA cert file if it exists
        if isinstance(self.ca_cert, str) and os.path.exists(self.ca_cert) and self.ca_cert.startswith(tempfile.gettempdir()):
            try:
                os.remove(self.ca_cert)
            except:
                pass
        
        return response.json().get('secret_data')

def main():
    # Debug environment variables
    print("Environment variables:")
    for k, v in os.environ.items():
        if k.startswith('INPUT_'):
            print(f"{k}: {'*' * min(len(v), 8)}")
    
    # Hyphen to underscore conversion for environment variables
    baseurl = os.getenv('INPUT_BASEURL')
    
    # Fallbacks and validation
    if not baseurl:
        baseurl = os.getenv('INPUT_BASEURL')  # Try alternative format
    
    if not baseurl:
        baseurl = os.getenv('INPUT_API_URL')  # Try old parameter name
        
    if not baseurl:
        raise ValueError("No base URL provided. Please set the 'base-url' input parameter.")

    api_token = os.getenv('INPUT_API_TOKEN')
    if not api_token:
        raise ValueError("No API token provided. Please set the 'api-token' input parameter.")
        
    box_id = os.getenv('INPUT_BOX_ID')
    secret_id = os.getenv('INPUT_SECRET_ID')
    ca_cert = os.getenv('INPUT_CA_CERT')
    
    vault_client = VaultClient(baseurl, api_token, ca_cert)
    secret = vault_client.checkout_secret(box_id, secret_id)
    print(f"::set-output name=secret::{secret}")

if __name__ == "__main__":
    main()
