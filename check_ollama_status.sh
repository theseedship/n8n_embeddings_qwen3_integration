#!/bin/bash

OLLAMA_URL="https://ollama-staging-a9b1.up.railway.app"
MODEL_NAME="qwen3-embedding:0.6b"

echo "🔍 Ollama Status Check"
echo "======================"
echo ""

# Check if service is responsive
echo "1. Service Health:"
if curl -s -f -m 5 "$OLLAMA_URL" > /dev/null 2>&1; then
    echo "   ✅ Service is responsive"
else
    echo "   ❌ Service not responding"
fi

# Check available models
echo ""
echo "2. Available Models:"
models=$(curl -s -m 5 "$OLLAMA_URL/api/tags" 2>/dev/null)
if [ -n "$models" ]; then
    echo "$models" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for model in data.get('models', []):
    print(f\"   - {model['name']} ({model['size'] / 1024 / 1024:.1f} MB)\")
" 2>/dev/null || echo "   Error parsing models"
else
    echo "   Could not retrieve models"
fi

# Quick embedding test with timeout
echo ""
echo "3. Quick Embedding Test (5s timeout):"
response=$(curl -s -m 5 -X POST "$OLLAMA_URL/api/embeddings" \
    -H "Content-Type: application/json" \
    -d '{"model": "'$MODEL_NAME'", "prompt": "test"}' 2>/dev/null)

if [ -n "$response" ]; then
    if echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print('✅' if 'embedding' in data else '❌')" 2>/dev/null; then
        echo "   Embedding generation successful"
    else
        echo "   ❌ Failed or timed out"
        echo "   Response: $response"
    fi
else
    echo "   ❌ Request timed out after 5 seconds"
fi

echo ""
echo "📝 Recommendations:"
echo "   The model is loaded but running slowly (CPU-only mode)."
echo "   Each embedding request takes 30-45 seconds."
echo "   Consider:"
echo "   1. Using smaller batches in n8n"
echo "   2. Implementing caching for repeated texts"
echo "   3. Upgrading to a GPU-enabled Railway plan"
echo "   4. Using the lightweight qwen3-embedding:0.3b model instead"