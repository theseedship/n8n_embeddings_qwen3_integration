# Ollama Embedding Server Setup for n8n

## Installation Options

### Option 1: Install Ollama (Requires sudo)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sudo sh

# Or via package manager (Arch Linux)
sudo pacman -S ollama

# Start Ollama service
ollama serve
```

### Option 2: Use Docker (Alternative)
```bash
# Run Ollama in Docker
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama

# Pull embedding model
docker exec -it ollama ollama pull nomic-embed-text
```

## Available Embedding Models

### Recommended Models
1. **nomic-embed-text** (137M params, 768 dims) - Best overall performance
   ```bash
   ollama pull nomic-embed-text
   ```

2. **mxbai-embed-large** (335M params, 1024 dims) - Higher quality
   ```bash
   ollama pull mxbai-embed-large
   ```

3. **all-minilm** (22M params, 384 dims) - Lightweight & fast
   ```bash
   ollama pull all-minilm
   ```

## Running the Servers

### Step 1: Stop Mock Server
```bash
# Find and kill the mock server
pkill -f test-server.py
```

### Step 2: Start Ollama (if not running)
```bash
# In a separate terminal
ollama serve
```

### Step 3: Pull an Embedding Model
```bash
# Choose one:
ollama pull nomic-embed-text      # Recommended
ollama pull mxbai-embed-large     # Higher quality
ollama pull all-minilm             # Fastest
```

### Step 4: Start the Ollama Embedding Server
```bash
cd ~/deposium_n8n_embeddings_integration
source venv/bin/activate
python ollama-server.py
```

## Testing the Setup

### 1. Check Server Health
```bash
curl http://127.0.0.1:8080/health
```

### 2. List Available Models
```bash
curl http://127.0.0.1:8080/models
```

### 3. Generate Test Embedding
```bash
curl -X POST http://127.0.0.1:8080/embed \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world",
    "model": "nomic-embed-text"
  }'
```

## n8n Configuration

No changes needed! The same credentials work:
- **API URL**: `http://127.0.0.1:8080`
- **API Key**: (leave empty)

## Environment Variables (Optional)

```bash
# Custom Ollama URL (if not localhost)
export OLLAMA_BASE_URL=http://localhost:11434

# Default model
export OLLAMA_MODEL=nomic-embed-text

# Then run the server
python ollama-server.py
```

## Troubleshooting

### Error: "Cannot connect to Ollama"
- Make sure Ollama is running: `ollama serve`
- Check if port 11434 is accessible: `curl http://localhost:11434`

### Error: "Model not found"
- Pull the model first: `ollama pull nomic-embed-text`
- List available models: `ollama list`

### Performance Issues
- Use a smaller model: `all-minilm` for faster processing
- Consider GPU acceleration if available
- Reduce batch sizes for large texts

## Model Comparison

| Model | Size | Dimensions | Speed | Quality | Use Case |
|-------|------|------------|-------|---------|----------|
| all-minilm | 22M | 384 | Fast | Good | Quick searches |
| nomic-embed-text | 137M | 768 | Medium | Great | Balanced |
| mxbai-embed-large | 335M | 1024 | Slow | Best | High accuracy |

## Production Recommendations

1. **Use nomic-embed-text** for most use cases
2. **Enable GPU** if available for 10x speedup
3. **Implement caching** for repeated queries
4. **Set up monitoring** for the Ollama service
5. **Use systemd** to auto-start Ollama on boot

## Systemd Service (Optional)

Create `/etc/systemd/system/ollama.service`:
```ini
[Unit]
Description=Ollama Service
After=network.target

[Service]
Type=simple
User=ollama
ExecStart=/usr/local/bin/ollama serve
Restart=always

[Install]
WantedBy=multi-user.target
```

Then enable it:
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```