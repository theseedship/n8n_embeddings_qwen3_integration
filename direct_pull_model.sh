#!/bin/bash

# Direct API call to pull Qwen3-Embedding model
# This initiates the pull and returns immediately

OLLAMA_URL="https://ollama-staging-a9b1.up.railway.app"
MODEL_NAME="qwen3-embedding:0.6b"

echo "🚀 Initiating Qwen3-Embedding-0.6B pull on Ollama"
echo "=================================================="
echo ""

# Start the pull in the background
echo "📦 Sending pull request to Ollama..."
curl -X POST "$OLLAMA_URL/api/pull" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$MODEL_NAME\"}" \
    --max-time 5 \
    2>/dev/null

echo ""
echo "✅ Pull request sent!"
echo ""
echo "The model is now downloading in the background on your Railway Ollama instance."
echo "This usually takes 3-5 minutes for a 639MB model."
echo ""
echo "You can check the status by:"
echo "1. Running: curl $OLLAMA_URL/api/tags | jq '.models[].name'"
echo "2. Checking Railway logs for the Ollama service"
echo "3. Running the test script: python3 test_ollama_embedding.py"
echo ""
echo "Once ready, test with:"
echo "curl -X POST $OLLAMA_URL/api/embeddings \\"
echo "  -d '{\"model\": \"$MODEL_NAME\", \"prompt\": \"test\"}'"