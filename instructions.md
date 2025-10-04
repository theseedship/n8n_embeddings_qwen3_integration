# n8n Qwen3-Embedding-0.6B Integration Instructions

## Overview
Build a custom n8n community node for Qwen3-Embedding-0.6B model integration, enabling text embedding generation for semantic search applications with self-hosted model deployment. Qwen3-Embedding is a state-of-the-art multilingual embedding model with MRL support for flexible dimensions.

## Prerequisites
- [ ] Node.js >= 20.15 installed
- [ ] n8n latest version installed locally
- [ ] Python 3.8+ with PyTorch for model hosting
- [ ] At least 2GB RAM for Qwen3-Embedding-0.6B model
- [ ] GPU optional but recommended for faster inference (supports flash_attention_2)

## Goals
1. **Primary Goal**: Create a functional n8n node for generating text embeddings using self-hosted Qwen3-Embedding-0.6B
2. **Secondary Goals**:
   - Set up self-hosted Qwen3 embedding API server
   - Implement proper credential management for API access
   - Support customizable embedding dimensions (32-1024 via MRL)
   - Enable context prefix for semantic search optimization with instruction-aware prompts

## Architecture Overview

```
┌─────────────────┐     HTTP API      ┌──────────────────┐
│   n8n Workflow  │ ──────────────────▶│  Qwen3 Server    │
│  [QwenEmbedding │                    │  (Self-Hosted)   │
│      Node]      │◀────────────────── │  localhost:8080  │
└─────────────────┘    Embeddings     └──────────────────┘
```

## Step-by-Step Instructions

### Step 1: Set Up Qwen3-Embedding-0.6B Server
**Objective**: Deploy the embedding model locally with an HTTP API endpoint

**Instructions**:
1. Create a new directory for the model server:
   ```bash
   mkdir ~/qwen3-embedding-server
   cd ~/qwen3-embedding-server
   ```

2. Create Python environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install torch transformers>=4.51.0 sentence-transformers>=2.7.0 fastapi uvicorn pydantic
   # Optional for better performance:
   pip install flash-attn --no-build-isolation
   ```

3. Create `server.py` with the following structure:
   - Load Qwen3-Embedding-0.6B model with sentence-transformers
   - FastAPI endpoints for `/embed` and `/health`
   - Support for MRL dimension reduction (32-1024)
   - Instruction-aware prompts for better performance
   - JSON request/response format

4. Model server API specification:
   ```json
   POST /embed
   {
     "text": "Your input text",
     "prefix": "Optional context prefix",
     "dimensions": 1024,  // Optional, supports 32-1024 (default: 1024)
     "instruction": "query"  // Optional: "query" or "document"
   }

   Response:
   {
     "embedding": [0.123, -0.456, ...],
     "dimensions": 1024,
     "model": "Qwen3-Embedding-0.6B"
   }
   ```

**Expected Result**: Server running on `http://localhost:8080` with working `/health` endpoint

### Step 2: Create Qwen Credentials Node
**Objective**: Build credential management for API authentication

**Instructions**:
1. Create `credentials/QwenApi.credentials.ts`:
   ```typescript
   - name: 'qwenApi'
   - displayName: 'Qwen Embedding API'
   - properties:
     * apiUrl (string): Self-hosted server URL
     * apiKey (string, password): Optional API key for authentication
   ```

2. Update `package.json` to register the credential:
   ```json
   "credentials": [
     "dist/credentials/QwenApi.credentials.js"
   ]
   ```

3. Remove example credentials that won't be used

**Expected Result**: New credential type appears in n8n credential manager

### Step 3: Create QwenEmbedding Node
**Objective**: Implement the main embedding generation node

**Instructions**:
1. Create `nodes/QwenEmbedding/QwenEmbedding.node.ts` with:
   - Node metadata (name, icon, description)
   - Input parameters:
     * Text (string, required)
     * Context Prefix (string, optional)
     * Dimensions (number, optional, default: 1024, range: 32-1024)
     * Instruction Type (dropdown, optional: "query" or "document")
   - Authentication using QwenApi credentials
   - HTTP request to embedding server
   - Error handling for connection/model failures

2. Create icon file `nodes/QwenEmbedding/qwen.svg`

3. Update `package.json` to register the node:
   ```json
   "nodes": [
     "dist/nodes/QwenEmbedding/QwenEmbedding.node.js"
   ]
   ```

**Expected Result**: QwenEmbedding node appears in n8n node palette

### Step 4: Implement Core Functionality
**Objective**: Complete the node implementation with proper error handling

**Node Implementation Features**:
1. **Input validation**: Check text length limits
2. **Request building**: Format API request with prefix support
3. **Response handling**: Parse embedding array correctly
4. **Error states**:
   - Server unreachable
   - Invalid input text
   - Model processing error
   - Dimension mismatch

**Expected Result**: Node successfully generates embeddings for input text

### Step 5: Build and Test
**Objective**: Compile TypeScript and test in n8n

**Instructions**:
1. Update package name in `package.json`:
   ```json
   "name": "n8n-nodes-qwen-embedding"
   ```

2. Build the node:
   ```bash
   npm install
   npm run build
   ```

3. Link for local testing:
   ```bash
   npm link
   cd ~/.n8n/custom
   npm link n8n-nodes-qwen-embedding
   ```

4. Start n8n and test the workflow

**Expected Result**: Node works in n8n workflows without errors

## Verification

### Success Criteria
- [ ] Qwen embedding server responds to health checks
- [ ] Credentials can be saved and loaded in n8n
- [ ] Node generates valid embedding arrays
- [ ] Context prefix properly prepends to input text
- [ ] Custom dimensions work when supported
- [ ] Error messages are clear and actionable

### Testing
1. **Basic Embedding Test**:
   - Input: "What is machine learning?"
   - Expected Output: Array of floats with correct dimension count

2. **Context Prefix Test**:
   - Input: "neural networks"
   - Prefix: "This document is about:"
   - Expected Output: Different embedding than without prefix

3. **Error Handling Test**:
   - Input: Empty string
   - Expected Output: Meaningful error message

## Troubleshooting

### Common Issues

#### Issue 1: Model Download Fails
**Solution**: Use Hugging Face mirror or download manually:
```bash
export HF_ENDPOINT=https://hf-mirror.com
# Or download with git-lfs
```

#### Issue 2: Out of Memory Error
**Solution**:
- Use CPU-only mode if GPU memory insufficient
- Implement batch size limits
- Consider quantization for smaller memory footprint

#### Issue 3: n8n Node Not Appearing
**Solution**:
- Check `npm link` was successful
- Verify paths in package.json
- Restart n8n after linking
- Check n8n logs for loading errors

## API Server Template Structure

```python
# server.py basic structure
from fastapi import FastAPI, HTTPException
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel
from typing import Optional
import numpy as np

app = FastAPI()

# Load model with optional flash attention for speed
model_kwargs = {}
try:
    import flash_attn
    model_kwargs["attn_implementation"] = "flash_attention_2"
except ImportError:
    pass

model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B", model_kwargs=model_kwargs)

class EmbedRequest(BaseModel):
    text: str
    prefix: Optional[str] = ""
    dimensions: Optional[int] = 1024  # MRL: 32-1024
    instruction: Optional[str] = None  # "query" or "document"

@app.post("/embed")
async def generate_embedding(request: EmbedRequest):
    # Prepend prefix if provided
    full_text = f"{request.prefix} {request.text}".strip() if request.prefix else request.text

    # Use instruction-aware encoding for better performance
    prompt_name = request.instruction if request.instruction in ["query", "document"] else None

    # Generate embedding with MRL dimension support
    if request.dimensions and request.dimensions != 1024:
        with model.truncate_sentence_embeddings(truncate_dim=request.dimensions):
            embedding = model.encode(full_text, prompt_name=prompt_name)
    else:
        embedding = model.encode(full_text, prompt_name=prompt_name)

    return {
        "embedding": embedding.tolist(),
        "dimensions": len(embedding),
        "model": "Qwen3-Embedding-0.6B"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model": "Qwen3-Embedding-0.6B", "max_context": 32768}
```

## Notes
- **Important**: Qwen3-Embedding-0.6B uses ~2GB memory and supports 32K token context
- **MRL Feature**: Can use any dimension from 32-1024 without retraining (Matryoshka Representation Learning)
- **Performance Tips**:
  - Use `instruction="query"` for search queries (1-5% boost)
  - Use `instruction="document"` for documents being indexed
  - Install flash_attn for 2x faster inference on GPU
- **Security**: Implement rate limiting if exposing to network
- **Reference**: [Qwen3-Embedding Model Card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)

## Next Steps After Implementation
1. Add batch processing support for multiple texts
2. Implement embedding caching for repeated queries
3. Add support for other Qwen model sizes
4. Create similarity calculation utilities
5. Add OpenAPI documentation to server