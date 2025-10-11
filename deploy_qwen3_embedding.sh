#!/bin/bash

# Qwen3-Embedding-0.6B Deployment Script for Railway Ollama
# This script deploys the Qwen3 embedding model to your Ollama instance

OLLAMA_URL="https://ollama-staging-a9b1.up.railway.app"
MODEL_NAME="qwen3-embedding:0.6b"

echo "🚀 Deploying Qwen3-Embedding-0.6B to Ollama on Railway"
echo "=================================================="
echo ""

# Step 1: Wake up the Ollama service if it's sleeping
echo "1️⃣  Checking Ollama service status..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$OLLAMA_URL/api/tags" --max-time 10)

if [ "$response" != "200" ]; then
    echo "   ⏰ Ollama service is sleeping. Waking it up..."
    echo "   Please wait 30-60 seconds for the service to start..."

    # Make a request to wake the service
    curl -s "$OLLAMA_URL" > /dev/null 2>&1

    # Wait for service to be ready
    for i in {1..12}; do
        sleep 5
        response=$(curl -s -o /dev/null -w "%{http_code}" "$OLLAMA_URL/api/tags" --max-time 10)
        if [ "$response" == "200" ]; then
            echo "   ✅ Ollama service is now active!"
            break
        fi
        echo "   ⏳ Still waking up... ($((i*5))/60 seconds)"
    done

    if [ "$response" != "200" ]; then
        echo "   ❌ Failed to wake Ollama service. Please check Railway logs."
        exit 1
    fi
else
    echo "   ✅ Ollama service is already active!"
fi

echo ""

# Step 2: Check existing models
echo "2️⃣  Checking existing models..."
existing_models=$(curl -s "$OLLAMA_URL/api/tags" | jq -r '.models[]?.name' 2>/dev/null)

if echo "$existing_models" | grep -q "$MODEL_NAME"; then
    echo "   ⚠️  Model $MODEL_NAME already exists on the server."
    read -p "   Do you want to re-pull it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Skipping model pull."
    else
        echo "   Re-pulling model..."
    fi
else
    echo "   📦 Model not found. Will pull it now."
    REPLY="y"
fi

echo ""

# Step 3: Pull the model
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "3️⃣  Pulling $MODEL_NAME from Ollama library..."
    echo "   This may take a few minutes (model size: ~639MB)..."

    # Start the pull request
    response=$(curl -s -X POST "$OLLAMA_URL/api/pull" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$MODEL_NAME\"}")

    # Monitor the pull progress
    echo "   Downloading..."
    sleep 5

    # Check if pull was successful by listing models again
    for i in {1..60}; do
        sleep 5
        models=$(curl -s "$OLLAMA_URL/api/tags" | jq -r '.models[]?.name' 2>/dev/null)
        if echo "$models" | grep -q "$MODEL_NAME"; then
            echo "   ✅ Model successfully pulled!"
            break
        fi
        echo "   ⏳ Still pulling... ($((i*5))/300 seconds)"

        if [ "$i" -eq 60 ]; then
            echo "   ⚠️  Pull is taking longer than expected. Check Railway logs for details."
        fi
    done
fi

echo ""

# Step 4: Test the embedding model
echo "4️⃣  Testing the embedding model..."
test_response=$(curl -s -X POST "$OLLAMA_URL/api/embeddings" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "'"$MODEL_NAME"'",
        "prompt": "Hello, this is a test embedding"
    }')

if echo "$test_response" | jq -e '.embedding' > /dev/null 2>&1; then
    embedding_dims=$(echo "$test_response" | jq '.embedding | length')
    echo "   ✅ Embedding test successful!"
    echo "   📊 Embedding dimensions: $embedding_dims"
else
    echo "   ❌ Embedding test failed. Response:"
    echo "$test_response" | jq '.' 2>/dev/null || echo "$test_response"
fi

echo ""
echo "=================================================="
echo "✅ Deployment Complete!"
echo ""
echo "📝 Usage Information:"
echo "   - Model: $MODEL_NAME"
echo "   - API Endpoint: $OLLAMA_URL/api/embeddings"
echo "   - Context Length: 32K tokens"
echo "   - Embedding Dimensions: 1024 (default)"
echo ""
echo "🔧 Example cURL request:"
echo "curl -X POST $OLLAMA_URL/api/embeddings \\"
echo '  -H "Content-Type: application/json" \'
echo "  -d '{\"model\": \"$MODEL_NAME\", \"prompt\": \"Your text here\"}'"
echo ""
echo "🔗 For n8n integration, use:"
echo "   - URL: $OLLAMA_URL/api/embeddings"
echo "   - Model: $MODEL_NAME"