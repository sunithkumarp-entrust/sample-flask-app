package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

// Constants
const checkoutSecretAPI = "/vault/1.0/CheckoutSecret/"

// SecretRequest represents the request body for the checkout secret endpoint
type SecretRequest struct {
	BoxID    string `json:"box_id"`
	SecretID string `json:"secret_id"`
}

// SecretResponse represents the response from the checkout secret endpoint
type SecretResponse struct {
	SecretData string `json:"secret_data"`
}

// VaultClient handles interactions with the vault API
type VaultClient struct {
	BaseURL  string
	APIToken string
	CACert   string
	client   *http.Client
}

// NewVaultClient creates a new vault client
func NewVaultClient(baseURL, apiToken string, caCert string) (*VaultClient, error) {
	// Set up default HTTP client
	client := &http.Client{}

	// Process CA certificate if provided
	caCert, err := processCACertificate(caCert)
	if err != nil {
		return nil, fmt.Errorf("error processing CA certificate: %w", err)
	}

	return &VaultClient{
		BaseURL:  baseURL,
		APIToken: apiToken,
		CACert:   caCert,
		client:   client,
	}, nil
}

// processCACertificate handles base64 encoded certificates
func processCACertificate(caCert string) (string, error) {
	// If no cert provided
	if caCert == "" {
		return "", nil
	}

	// If cert is "False", disable verification
	if caCert == "False" {
		return "False", nil
	}

	// Check if it's a file path
	if _, err := os.Stat(caCert); err == nil {
		// It's a valid path, return as is
		return caCert, nil
	}

	// Try to decode as base64
	decoded, err := base64.StdEncoding.DecodeString(caCert)
	if err != nil {
		return "", fmt.Errorf("not a valid certificate: %w", err)
	}

	// Create temp file for the certificate
	tempDir := os.TempDir()
	tempFile, err := os.CreateTemp(tempDir, "ca-cert-*.pem")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer tempFile.Close()

	// Write the decoded certificate
	if _, err := tempFile.Write(decoded); err != nil {
		return "", fmt.Errorf("failed to write certificate: %w", err)
	}

	return tempFile.Name(), nil
}

// maskSecret masks a secret, showing only the last 2 characters
func maskSecret(secret string) string {
	if secret == "" || len(secret) < 3 {
		return "**"
	}
	return strings.Repeat("*", len(secret)-2) + secret[len(secret)-2:]
}

// CheckoutSecret retrieves a secret from the vault
func (vc *VaultClient) CheckoutSecret(boxID, secretID string) (string, error) {
	// Prepare request body
	reqBody := SecretRequest{
		BoxID:    boxID,
		SecretID: secretID,
	}

	reqBodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("error marshaling request body: %w", err)
	}

	// Create request
	apiURL := vc.BaseURL + checkoutSecretAPI
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(reqBodyBytes))
	if err != nil {
		return "", fmt.Errorf("error creating request: %w", err)
	}

	// Add headers
	req.Header.Set("X-Vault-Auth", vc.APIToken)
	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := vc.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error making request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("error from server: %s, status: %d", string(bodyBytes), resp.StatusCode)
	}

	// Parse response
	var secretResp SecretResponse
	if err := json.NewDecoder(resp.Body).Decode(&secretResp); err != nil {
		return "", fmt.Errorf("error decoding response: %w", err)
	}

	// Clean up the temporary CA cert file if it exists
	if vc.CACert != "" && !strings.HasPrefix(vc.CACert, os.TempDir()) {
		if err := os.Remove(vc.CACert); err != nil {
			log.Printf("Warning: failed to remove temporary CA cert file: %v", err)
		}
	}

	return secretResp.SecretData, nil
}

func main() {
	// Debug environment variables
	fmt.Println("Environment variables:")
	for _, env := range os.Environ() {
		pair := strings.SplitN(env, "=", 2)
		if strings.HasPrefix(pair[0], "INPUT_") {
			fmt.Printf("%s: %s\n", pair[0], strings.Repeat("*", 8))
		}
	}

	// Get input parameters
	baseURL := os.Getenv("INPUT_BASE_URL")

	if baseURL == "" {
		log.Fatal("No base URL provided. Please set the 'baseurl' input parameter.")
	}

	apiToken := os.Getenv("INPUT_API_TOKEN")
	if apiToken == "" {
		log.Fatal("No API token provided. Please set the 'api_token' input parameter.")
	}

	boxID := os.Getenv("INPUT_BOX_ID")
	secretID := os.Getenv("INPUT_SECRET_ID")
	caCert := os.Getenv("INPUT_CA_CERT")

	// Create vault client
	vaultClient, err := NewVaultClient(baseURL, apiToken, caCert)
	if err != nil {
		log.Fatalf("Failed to create vault client: %v", err)
	}

	// Checkout secret
	secret, err := vaultClient.CheckoutSecret(boxID, secretID)
	if err != nil {
		log.Fatalf("Failed to checkout secret: %v", err)
	}

	// Log the masked secret
	fmt.Printf("Secret retrieved: %s\n", maskSecret(secret))

	// Set output using GitHub Actions output syntax
	githubOutput := os.Getenv("GITHUB_OUTPUT")
	if githubOutput != "" {
		// Write to GITHUB_OUTPUT file
		f, err := os.OpenFile(githubOutput, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			log.Fatalf("Failed to open GITHUB_OUTPUT file: %v", err)
		}
		defer f.Close()
		if _, err := f.WriteString(fmt.Sprintf("secret=%s\n", secret)); err != nil {
			log.Fatalf("Failed to write to GITHUB_OUTPUT file: %v", err)
		}
	} else {
		// Fall back to set-output command
		fmt.Printf("secret=%s\n", secret)
	}
}
