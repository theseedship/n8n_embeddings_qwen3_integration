#!/bin/bash

echo "================================"
echo "n8n Qwen Embedding Test Script"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

echo "✅ npm is installed"
echo ""

# Build the nodes
echo "📦 Building n8n nodes..."
if npm run build; then
    echo "✅ Nodes built successfully"
else
    echo "❌ Failed to build nodes"
    exit 1
fi
echo ""

# Check if containers are running
echo "🐳 Checking Docker containers..."
if [ "$(docker ps -q -f name=ollama-embeddings)" ]; then
    echo "✅ Ollama container is running"
else
    echo "⚠️  Ollama container is not running. Use 'make up' to start it."
fi

if [ "$(docker ps -q -f name=n8n-embeddings)" ]; then
    echo "✅ n8n container is running"
else
    echo "⚠️  n8n container is not running. Use 'make up' to start it."
fi
echo ""

# Test Ollama API
echo "🔍 Testing Ollama API..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama API is accessible"

    # Check if model is loaded
    if curl -s http://localhost:11434/api/tags | grep -q "qwen"; then
        echo "✅ Qwen model is loaded"
    else
        echo "⚠️  Qwen model not found. Use 'make init-model' to download it."
    fi
else
    echo "❌ Ollama API is not accessible. Make sure the container is running."
fi
echo ""

# Test n8n
echo "🔍 Testing n8n..."
if curl -s http://localhost:5678 > /dev/null 2>&1; then
    echo "✅ n8n is accessible at http://localhost:5678"
else
    echo "❌ n8n is not accessible. Make sure the container is running."
fi
echo ""

echo "================================"
echo "Setup Status Summary"
echo "================================"
echo ""
echo "To start the development environment, run:"
echo "  make dev"
echo ""
echo "This will:"
echo "  1. Build the custom nodes"
echo "  2. Start Ollama and n8n containers"
echo "  3. Download the Qwen embedding model"
echo "  4. Make everything ready for testing"
echo ""
echo "For more commands, run: make help"