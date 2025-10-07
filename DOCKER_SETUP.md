# Docker Development Setup for n8n Qwen Embedding Integration

This setup provides a complete development environment with Ollama (for running Qwen embedding models) and n8n with your custom embedding nodes pre-installed.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Docker Network                  │
│                                              │
│  ┌──────────────┐      ┌──────────────────┐ │
│  │   Ollama     │◄─────│      n8n         │ │
│  │  Container   │      │   Container      │ │
│  │              │      │                  │ │
│  │ Qwen Model   │      │  Custom Nodes    │ │
│  │   :11434     │      │     :5678        │ │
│  └──────────────┘      └──────────────────┘ │
│         ▲                        ▲          │
└─────────┼────────────────────────┼──────────┘
          │                        │
     ./data/ollama            ./data/n8n
     (model storage)         (workflows/db)
```

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for building the custom nodes)
- At least 4GB free disk space for model storage
- 8GB RAM recommended

## Quick Start

### 1. Build the n8n nodes
```bash
npm install
npm run build
```

### 2. Start all services
```bash
make dev
```

This will:
- Create necessary data directories
- Build and start Docker containers
- Download the Qwen embedding model
- Start n8n with your custom nodes

### 3. Access the services
- **n8n UI**: http://localhost:5678
- **Ollama API**: http://localhost:11434

## Available Commands

```bash
make help         # Show all available commands
make up          # Start all services
make down        # Stop all services
make restart     # Restart all services
make logs        # Show logs from all services
make init-model  # Download and initialize Qwen model
make clean       # Clean up all data and containers
make rebuild     # Rebuild everything from scratch
make test-ollama # Test Ollama API connection
make test-embedding # Test embedding generation
make status      # Check status of all services
```

## Testing the Integration

### 1. Verify Ollama is running
```bash
make test-ollama
```

Expected output: List of available models including `qwen2.5:0.5b`

### 2. Test embedding generation
```bash
make test-embedding
```

Expected output: JSON with embedding vector

### 3. Create a test workflow in n8n

1. Open n8n at http://localhost:5678
2. Create a new workflow
3. Add a "Qwen Embedding" node
4. Configure it with:
   - Ollama URL: `http://ollama:11434`
   - Model: `qwen2.5:0.5b`
5. Connect it to your workflow and test

## Configuration

### Environment Variables
Copy `.env.example` to `.env` and modify as needed:

```bash
cp .env.example .env
```

Key variables:
- `OLLAMA_MODEL`: Model to use (default: qwen2.5:0.5b)
- `N8N_PORT`: n8n web interface port (default: 5678)
- `OLLAMA_PORT`: Ollama API port (default: 11434)

### Data Persistence
All data is stored in `./data/`:
- `./data/ollama/`: Ollama models and configuration
- `./data/n8n/`: n8n workflows, credentials, and database

## Troubleshooting

### Ollama model not downloading
```bash
# Manually trigger model download
docker exec -it ollama-embeddings ollama pull qwen2.5:0.5b
```

### n8n nodes not appearing
```bash
# Rebuild the nodes
npm run build
# Restart n8n container
docker-compose restart n8n
```

### Permission issues
```bash
# Fix data directory permissions
sudo chown -R $(id -u):$(id -g) ./data
```

### Container networking issues
```bash
# Check if containers can communicate
docker exec n8n-embeddings ping ollama
```

### View container logs
```bash
# View Ollama logs
make logs-ollama

# View n8n logs
make logs-n8n
```

## Development Workflow

1. **Make changes** to your node code in `nodes/`
2. **Build** the changes: `npm run build`
3. **Restart** n8n: `docker-compose restart n8n`
4. **Test** in n8n UI at http://localhost:5678

For continuous development:
```bash
# Terminal 1: Watch and rebuild on changes
npm run dev

# Terminal 2: Watch n8n logs
make logs-n8n
```

## Production Considerations

For production deployment:

1. **Change encryption key** in `.env`
2. **Enable authentication**: Set `N8N_BASIC_AUTH_ACTIVE=true`
3. **Use SSL/TLS**: Configure reverse proxy with HTTPS
4. **Backup data**: Regular backups of `./data` directory
5. **Resource limits**: Add Docker resource constraints
6. **Monitoring**: Set up container health monitoring

## Model Information

The setup uses **Qwen2.5:0.5b** model which is:
- Lightweight (≈500MB download)
- Optimized for embedding generation
- Fast inference on CPU
- Suitable for development/testing

For production, consider larger models like:
- `qwen2.5:1.5b` - Better quality, more resources
- `qwen2.5:3b` - High quality, requires GPU

## Support

For issues or questions:
1. Check container logs: `make logs`
2. Verify services status: `make status`
3. Ensure Docker has enough resources
4. Check GitHub issues for known problems