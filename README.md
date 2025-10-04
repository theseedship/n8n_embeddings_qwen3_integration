# n8n-nodes-qwen-embedding

[![NPM Version](https://img.shields.io/npm/v/n8n-nodes-qwen-embedding)](https://www.npmjs.com/package/n8n-nodes-qwen-embedding)
[![License](https://img.shields.io/npm/l/n8n-nodes-qwen-embedding)](https://github.com/gabzim/n8n-nodes-qwen-embedding/blob/master/LICENSE)
[![n8n Community](https://img.shields.io/badge/n8n-community_node-orange)](https://n8n.io/integrations)

n8n community nodes for integrating Qwen3-Embedding models with your n8n workflows. Generate high-quality text embeddings using self-hosted Qwen models for vector stores, similarity search, and AI applications.

## 🌟 Features

- **Two Specialized Nodes**:
  - **Qwen Embedding**: For vector store integration (Supabase, Qdrant, PGVector, etc.)
  - **Qwen Embedding Tool**: For direct embedding generation in workflows
- **LangChain Compatible**: Seamlessly integrates with n8n's AI ecosystem
- **Flexible Dimensions**: Support for 32-1024 dimensions via MRL (Matryoshka Representation Learning)
- **Instruction-Aware**: Optimized embeddings for queries vs documents
- **Batch Processing**: Efficient bulk embedding generation
- **Self-Hosted**: Complete control over your embedding infrastructure

## 📦 Installation

### In n8n

1. Go to **Settings** > **Community Nodes**
2. Search for `n8n-nodes-qwen-embedding`
3. Click **Install**

### Manual Installation

```bash
npm install n8n-nodes-qwen-embedding
```

## 🚀 Prerequisites

You need to run the Qwen3-Embedding server. A sample server implementation is provided:

```python
# qwen3_embedding_server.py
pip install fastapi uvicorn torch transformers

# Run the server
python qwen3_embedding_server.py
```

The server will be available at `http://localhost:8080`

## 🔧 Setup

### 1. Configure Credentials

1. In n8n, go to **Credentials** > **New**
2. Select **Qwen Embedding API**
3. Enter:
   - **API URL**: `http://localhost:8080` (or your server URL)
   - **API Key**: (optional, if you've configured authentication)
4. Click **Test Connection** to verify

### 2. Using the Nodes

#### Qwen Embedding (Vector Store Integration)

Connect to any vector store node:

```
[Vector Store] ← [Qwen Embedding]
   (Stores)        (Provides embeddings)
```

**Use Cases:**
- RAG applications
- Semantic search
- Document indexing
- Knowledge bases

#### Qwen Embedding Tool (Direct Usage)

Use in any workflow for direct embedding generation:

```
[Trigger] → [Qwen Embedding Tool] → [Process/Store]
```

**Use Cases:**
- Similarity calculations
- Text clustering
- Anomaly detection
- Content deduplication

## ⚙️ Configuration Options

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| **Dimensions** | Embedding vector size (32-1024) | 1024 |
| **Instruction Type** | Query/Document/None for optimized embeddings | None |
| **Context Prefix** | Prefix to add context to text | - |

### Tool-Specific Options

| Option | Description | Available In |
|--------|-------------|--------------|
| **Operation** | Single or batch embedding | Tool only |
| **Return Format** | Full/Simplified/Embedding only | Tool only |
| **Include Metadata** | Add processing metadata | Tool only |

## 📝 Examples

### Example 1: Vector Store with RAG

```
1. Add "Supabase Vector Store" node
2. Add "Qwen Embedding" node
3. Connect Qwen to Vector Store's embedding input
4. Configure your collection and start indexing
```

### Example 2: Semantic Search

```
1. Add "Manual Trigger" node
2. Add "Qwen Embedding Tool" node (set to "Generate Embedding")
3. Add another "Qwen Embedding Tool" for documents
4. Add "Code" node to calculate similarities
```

### Example 3: Batch Processing

```javascript
// Input: Array of texts
{
  "texts": [
    "First document",
    "Second document",
    "Third document"
  ]
}

// Qwen Embedding Tool (Batch mode) output:
{
  "embeddings": [[...], [...], [...]],
  "count": 3,
  "dimensions": 1024
}
```

## 🔬 Technical Details

### Model Information

- **Model**: Qwen3-Embedding-0.6B
- **Parameters**: 570M
- **Context Length**: 32K tokens
- **Languages**: 29+ languages supported
- **Dimensions**: Variable 32-1024 (MRL)

### Performance

- **Query Optimization**: 1-5% performance boost with instruction type
- **Batch Size**: Recommended 32 texts per batch
- **Timeout**: Default 30 seconds (configurable)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Qwen Team](https://github.com/QwenLM) for the amazing embedding models
- [n8n Community](https://community.n8n.io/) for support and feedback
- [LangChain](https://github.com/langchain-ai/langchainjs) for the embedding interface

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/n8n-nodes-qwen-embedding)
- [GitHub Repository](https://github.com/gabzim/n8n-nodes-qwen-embedding)
- [n8n Community Nodes](https://n8n.io/integrations)
- [Qwen3-Embedding Paper](https://arxiv.org/abs/2411.00156)

## 📮 Support

For issues and questions:
- [GitHub Issues](https://github.com/gabzim/n8n-nodes-qwen-embedding/issues)
- [n8n Community Forum](https://community.n8n.io/)

---

Made with ❤️ for the n8n community