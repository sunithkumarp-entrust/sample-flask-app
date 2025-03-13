package main

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestMaskSecret(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"Empty string", "", "**"},
		{"Short string", "a", "**"},
		{"Two chars", "ab", "**"},
		{"Long string", "password123", "*********23"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := maskSecret(tc.input)
			if result != tc.expected {
				t.Errorf("maskSecret(%q) = %q; want %q", tc.input, result, tc.expected)
			}
		})
	}
}

func TestProcessCACertificate(t *testing.T) {
	t.Run("Empty cert", func(t *testing.T) {
		result, err := processCACertificate("")
		if err != nil {
			t.Errorf("processCACertificate('') error = %v; want nil", err)
		}
		if result != "" {
			t.Errorf("processCACertificate('') = %q; want ''", result)
		}
	})

	t.Run("False cert", func(t *testing.T) {
		result, err := processCACertificate("False")
		if err != nil {
			t.Errorf("processCACertificate('False') error = %v; want nil", err)
		}
		if result != "False" {
			t.Errorf("processCACertificate('False') = %q; want 'False'", result)
		}
	})

	t.Run("Base64 cert", func(t *testing.T) {
		// Create a simple base64 encoded string
		cert := base64.StdEncoding.EncodeToString([]byte("TEST CERTIFICATE"))
		result, err := processCACertificate(cert)
		if err != nil {
			t.Errorf("processCACertificate(base64) error = %v; want nil", err)
		}
		defer os.Remove(result) // Clean up

		// Check if file exists and contains the right content
		content, err := os.ReadFile(result)
		if err != nil {
			t.Errorf("Failed to read cert file: %v", err)
		}
		if string(content) != "TEST CERTIFICATE" {
			t.Errorf("Cert content = %q; want 'TEST CERTIFICATE'", string(content))
		}
	})
}

func TestCheckoutSecret(t *testing.T) {
	// Create a test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request method and path
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/vault/1.0/CheckoutSecret/" {
			t.Errorf("Expected path /vault/1.0/CheckoutSecret/, got %s", r.URL.Path)
		}

		// Check headers
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type: application/json, got %s", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("X-Vault-Auth") != "test-token" {
			t.Errorf("Expected X-Vault-Auth: test-token, got %s", r.Header.Get("X-Vault-Auth"))
		}

		// Return mock response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"secret_data":"TOP_SECRET"}`))
	}))
	defer server.Close()

	// Create vault client
	client, err := NewVaultClient(server.URL, "test-token", "")
	if err != nil {
		t.Fatalf("Failed to create vault client: %v", err)
	}

	// Test checkout secret
	secret, err := client.CheckoutSecret("Box1-test", "Secret1-test")
	if err != nil {
		t.Fatalf("CheckoutSecret error: %v", err)
	}
	if secret != "TOP_SECRET" {
		t.Errorf("CheckoutSecret() = %q; want 'TOP_SECRET'", secret)
	}
}

func TestCheckoutSecretError(t *testing.T) {
	// Create a test server that returns an error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error":"Not found"}`))
	}))
	defer server.Close()

	// Create vault client
	client, err := NewVaultClient(server.URL, "test-token", "")
	if err != nil {
		t.Fatalf("Failed to create vault client: %v", err)
	}

	// Test checkout secret - should error
	_, err = client.CheckoutSecret("Box1-test", "Secret1-test")
	if err == nil {
		t.Errorf("Expected error but got nil")
	}
}
