#!/usr/bin/env python3
"""
Qwen3-Embedding-0.6B Server for n8n Integration
This server provides embeddings using the official Qwen3-Embedding model from Hugging Face
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import torch
import numpy as np
import uvicorn
import os

app = FastAPI(title="Qwen3-Embedding-0.6B Server for n8n")

# Add CORS middleware to allow n8n to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None
tokenizer = None

class EmbedRequest(BaseModel):
    text: str
    prefix: Optional[str] = ""
    dimensions: Optional[int] = None  # MRL support: 32-1024
    instruction: Optional[str] = None  # "query" or "document"

def load_model():
    """Load the Qwen3-Embedding model from Hugging Face"""
    global model, tokenizer

    print("🔄 Loading Qwen3-Embedding-0.6B model...")
    print("   This may take a few minutes on first run...")

    try:
        from transformers import AutoModel, AutoTokenizer

        # Load model and tokenizer
        model_name = "Qwen/Qwen3-Embedding-0.6B"

        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            trust_remote_code=True
        )

        model = AutoModel.from_pretrained(
            model_name,
            trust_remote_code=True,
            torch_dtype=torch.float32
        )

        # Move to GPU if available
        if torch.cuda.is_available():
            model = model.cuda()
            print("   ✅ Model loaded on GPU")
        else:
            model = model.cpu()
            print("   ✅ Model loaded on CPU")

        model.eval()  # Set to evaluation mode

        print(f"✅ Qwen3-Embedding-0.6B loaded successfully!")
        print(f"   Model dimensions: 1024 (with MRL support for 32-1024)")

    except ImportError:
        print("❌ Missing required packages. Installing...")
        os.system("pip install transformers torch sentencepiece")
        print("   Please restart the server after installation.")
        exit(1)
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        exit(1)

@app.on_event("startup")
async def startup_event():
    """Load model on server startup"""
    load_model()

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Qwen3-Embedding-0.6B Server",
        "version": "1.0.0",
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "features": {
            "mrl": "Matryoshka Representation Learning (32-1024 dims)",
            "context_length": 32768,
            "default_dimensions": 1024,
            "multilingual": True
        },
        "endpoints": {
            "/health": "Health check",
            "/embed": "Generate embeddings",
            "/info": "Model information"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if model is not None:
        return {
            "status": "healthy",
            "model": "Qwen3-Embedding-0.6B",
            "model_loaded": True,
            "device": "cuda" if torch.cuda.is_available() else "cpu",
            "max_context": 32768,
            "dimensions": 1024,
            "mrl_range": "32-1024"
        }
    else:
        return {
            "status": "loading",
            "model": "Qwen3-Embedding-0.6B",
            "model_loaded": False
        }

@app.get("/info")
async def model_info():
    """Get detailed model information"""
    return {
        "model": {
            "name": "Qwen3-Embedding-0.6B",
            "parameters": "0.6B",
            "architecture": "Transformer-based",
            "training": "Contrastive learning"
        },
        "capabilities": {
            "languages": "Multilingual (29+ languages)",
            "max_tokens": 32768,
            "embedding_dim": 1024,
            "mrl": "32-1024 dimensions without retraining"
        },
        "usage": {
            "query": "Use instruction='query' for search queries",
            "document": "Use instruction='document' for documents",
            "dimensions": "Specify 32-1024 for custom dimensions"
        }
    }

def mean_pooling(model_output, attention_mask):
    """Mean pooling - take attention mask into account for correct averaging"""
    token_embeddings = model_output[0]
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)

@app.post("/embed")
async def generate_embedding(request: EmbedRequest):
    """Generate embeddings using Qwen3-Embedding-0.6B"""

    if model is None:
        raise HTTPException(status_code=503, detail="Model is still loading. Please wait...")

    # Validate text
    if not request.text or request.text.strip() == "":
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Prepare the text with optional prefix
    full_text = f"{request.prefix} {request.text}".strip() if request.prefix else request.text

    # Add instruction prefix if specified
    if request.instruction == "query":
        full_text = f"Instruct: Given a query, retrieve relevant passages that answer the query\nQuery: {full_text}"
    elif request.instruction == "document":
        full_text = f"Instruct: Embed this document for retrieval\nDocument: {full_text}"

    try:
        # Tokenize
        inputs = tokenizer(
            full_text,
            max_length=32768,
            padding=True,
            truncation=True,
            return_tensors="pt"
        )

        # Move to same device as model
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}

        # Generate embeddings
        with torch.no_grad():
            outputs = model(**inputs)

            # Mean pooling
            embeddings = mean_pooling(outputs, inputs['attention_mask'])

            # Normalize embeddings
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)

            # Convert to numpy and get first embedding (batch size 1)
            embedding = embeddings[0].cpu().numpy().tolist()

        # Apply dimension reduction if requested (MRL)
        target_dim = request.dimensions
        if target_dim and target_dim != 1024:
            if 32 <= target_dim <= 1024:
                embedding = embedding[:target_dim]
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Dimensions must be between 32 and 1024, got {target_dim}"
                )

        return {
            "embedding": embedding,
            "dimensions": len(embedding),
            "model": "Qwen3-Embedding-0.6B",
            "text_length": len(full_text),
            "mrl_applied": target_dim is not None and target_dim != 1024
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating embedding: {str(e)}"
        )

@app.post("/embed/batch")
async def generate_batch_embeddings(texts: List[str], instruction: Optional[str] = None, dimensions: Optional[int] = None):
    """Generate embeddings for multiple texts (batch processing)"""

    if model is None:
        raise HTTPException(status_code=503, detail="Model is still loading. Please wait...")

    embeddings = []
    for text in texts:
        try:
            result = await generate_embedding(
                EmbedRequest(
                    text=text,
                    instruction=instruction,
                    dimensions=dimensions
                )
            )
            embeddings.append(result["embedding"])
        except Exception as e:
            print(f"Error processing text: {e}")
            embeddings.append(None)

    return {
        "embeddings": embeddings,
        "model": "Qwen3-Embedding-0.6B",
        "count": len(embeddings),
        "dimensions": dimensions or 1024,
        "failed": sum(1 for e in embeddings if e is None)
    }

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 Qwen3-Embedding-0.6B Server")
    print("="*60)
    print("📍 API: http://localhost:8080")
    print("📚 Docs: http://localhost:8080/docs")
    print("🔧 Model: Qwen/Qwen3-Embedding-0.6B")
    print("📐 Dimensions: 1024 (MRL: 32-1024)")
    print("🌍 Languages: 29+ (Multilingual)")
    print("📝 Context: 32K tokens")
    print("="*60 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8080)