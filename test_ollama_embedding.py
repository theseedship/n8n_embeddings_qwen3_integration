#!/usr/bin/env python3
"""
Test script for Qwen3-Embedding model on Railway Ollama instance
"""

import json
import requests
import time
from typing import List, Dict, Any

OLLAMA_URL = "https://ollama-staging-a9b1.up.railway.app"
MODEL_NAME = "qwen3-embedding:0.6b"


def wake_ollama_service() -> bool:
    """Wake up the Ollama service if it's sleeping."""
    print("🔍 Checking Ollama service status...")

    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=10)
        if response.status_code == 200:
            print("✅ Ollama service is active")
            return True
    except requests.RequestException:
        pass

    print("⏰ Waking up Ollama service...")
    requests.get(OLLAMA_URL, timeout=5)

    # Wait for service to wake up
    for i in range(12):
        time.sleep(5)
        try:
            response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=10)
            if response.status_code == 200:
                print("✅ Ollama service is now active!")
                return True
        except requests.RequestException:
            pass
        print(f"⏳ Waiting... ({(i+1)*5}/60 seconds)")

    return False


def list_models() -> List[str]:
    """List all available models."""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=10)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return [model["name"] for model in models]
    except Exception as e:
        print(f"Error listing models: {e}")
    return []


def pull_model(model_name: str) -> bool:
    """Pull a model from Ollama library."""
    print(f"📦 Pulling {model_name}...")

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/pull",
            json={"name": model_name},
            stream=True,
            timeout=300
        )

        for line in response.iter_lines():
            if line:
                data = json.loads(line)
                if "status" in data:
                    status = data["status"]
                    if "total" in data and "completed" in data:
                        percent = (data["completed"] / data["total"]) * 100
                        print(f"   {status}: {percent:.1f}%", end='\r')
                    else:
                        print(f"   {status}")

        print("\n✅ Model pulled successfully!")
        return True

    except Exception as e:
        print(f"❌ Error pulling model: {e}")
        return False


def generate_embedding(text: str, model: str = MODEL_NAME) -> Dict[str, Any]:
    """Generate embedding for given text."""
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={
                "model": model,
                "prompt": text
            },
            timeout=30
        )

        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"Status {response.status_code}: {response.text}"}

    except Exception as e:
        return {"error": str(e)}


def calculate_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    import math

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)


def main():
    print("=" * 60)
    print("🚀 Qwen3-Embedding Test Script for Railway Ollama")
    print("=" * 60)
    print()

    # Step 1: Wake up service
    if not wake_ollama_service():
        print("❌ Failed to wake Ollama service")
        return

    print()

    # Step 2: Check if model exists
    print("📋 Available models:")
    models = list_models()
    if models:
        for model in models:
            print(f"   - {model}")
    else:
        print("   No models found")

    print()

    # Step 3: Pull model if needed
    if MODEL_NAME not in models:
        print(f"Model {MODEL_NAME} not found.")
        pull_model(MODEL_NAME)
    else:
        print(f"✅ Model {MODEL_NAME} is already available")

    print()

    # Step 4: Test embeddings
    print("🧪 Testing embeddings...")
    print()

    test_texts = [
        "The quick brown fox jumps over the lazy dog",
        "A fast auburn canine leaps above a sleepy hound",
        "Machine learning is transforming technology",
        "Python is a programming language",
        "Dogs are loyal companions"
    ]

    embeddings = []
    for i, text in enumerate(test_texts, 1):
        print(f"Generating embedding {i}/{len(test_texts)}: {text[:50]}...")
        result = generate_embedding(text)

        if "embedding" in result:
            embeddings.append(result["embedding"])
            print(f"   ✅ Success! Dimensions: {len(result['embedding'])}")
        else:
            print(f"   ❌ Failed: {result.get('error', 'Unknown error')}")

    print()

    # Step 5: Calculate similarities
    if len(embeddings) >= 2:
        print("📊 Similarity Matrix (Cosine Similarity):")
        print()
        print("     ", end="")
        for i in range(len(test_texts)):
            print(f"  T{i+1}  ", end="")
        print()

        for i in range(len(embeddings)):
            print(f"T{i+1}: ", end="")
            for j in range(len(embeddings)):
                if i == j:
                    print(" 1.00 ", end="")
                else:
                    sim = calculate_similarity(embeddings[i], embeddings[j])
                    print(f" {sim:.2f} ", end="")
            print()

        print()
        print("Legend:")
        for i, text in enumerate(test_texts, 1):
            print(f"T{i}: {text[:50]}...")

    print()
    print("=" * 60)
    print("✅ Test Complete!")
    print()
    print("📝 Integration Details for n8n:")
    print(f"   - Endpoint: {OLLAMA_URL}/api/embeddings")
    print(f"   - Model: {MODEL_NAME}")
    print(f"   - Method: POST")
    print('   - Body: {"model": "' + MODEL_NAME + '", "prompt": "your text"}')


if __name__ == "__main__":
    main()