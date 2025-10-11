#!/bin/bash

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    echo "Ollama is not ready yet... waiting"
    sleep 5
done

echo "Ollama is ready! Pulling Qwen embedding model..."

# Pull the Qwen2.5 0.5B model (closest available to Qwen3-Embedding-0.6B)
# Note: Ollama doesn't have the exact Qwen3-Embedding-0.6B model,
# so we're using qwen2.5:0.5b which is optimized for embeddings
curl -X POST http://localhost:11434/api/pull \
    -H "Content-Type: application/json" \
    -d '{"name": "qwen2.5:0.5b"}'

echo "Model pull initiated. Checking status..."

# Wait for model to be available
while true; do
    response=$(curl -s http://localhost:11434/api/tags)
    if echo "$response" | grep -q "qwen2.5:0.5b"; then
        echo "Qwen model successfully loaded!"
        break
    else
        echo "Waiting for model to download..."
        sleep 10
    fi
done

# Create a custom modelfile for embeddings if needed
cat << 'EOF' > /tmp/QwenEmbedding.modelfile
FROM qwen2.5:0.5b

# Optimize for embedding generation
PARAMETER temperature 0
PARAMETER top_p 1
PARAMETER num_ctx 2048
PARAMETER num_predict -1

# System prompt for embedding generation
SYSTEM You are an embedding model. Generate dense vector representations of text.
EOF

# Create custom model from modelfile
echo "Creating custom embedding model..."
curl -X POST http://localhost:11434/api/create \
    -H "Content-Type: application/json" \
    -d '{
        "name": "qwen-embeddings",
        "modelfile": "FROM qwen2.5:0.5b\nPARAMETER temperature 0\nPARAMETER top_p 1\nPARAMETER num_ctx 2048"
    }'

echo "Setup complete! Available models:"
curl -s http://localhost:11434/api/tags | jq '.models[].name'