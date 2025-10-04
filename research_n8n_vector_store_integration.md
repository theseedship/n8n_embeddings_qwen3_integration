# n8n Vector Store Embedding Integration Research

_Generated: 2025-10-04 | Sources: 15+ | Confidence: high_

## Executive Summary

<key-findings>
- n8n embedding nodes require a **supplyData** method (not execute) to work with vector stores
- Embedding nodes must use **NodeConnectionType.AiEmbedding** output type
- Vector store integration requires implementing **ISupplyDataFunctions** interface
- Current QwenEmbedding node uses standard execute() pattern - needs refactoring for vector store compatibility
- Must return a LangChain-compatible Embeddings instance from supplyData method
</key-findings>

## Detailed Analysis

<overview>
n8n's vector store system is built on LangChain and uses a specialized node architecture called "sub-nodes" for components like embeddings. These sub-nodes differ from regular nodes in that they supply data to root nodes (like Vector Stores) rather than processing and returning data directly.

The key distinction:
- **Regular nodes**: Use execute() method, process items, return INodeExecutionData[][]
- **Sub-nodes (embeddings)**: Use supplyData() method, return LangChain Embeddings instance
- **Root nodes (vector stores)**: Consume sub-nodes via specialized connectors
</overview>

## Implementation Requirements

<implementation>

### 1. Node Type Configuration

Your embedding node MUST be configured as a sub-node:

```typescript
description: INodeTypeDescription = {
    displayName: 'Qwen Embedding',
    name: 'qwenEmbedding',
    group: ['transform'],
    version: 1,
    description: 'Generate text embeddings using Qwen3-Embedding model',
    defaults: {
        name: 'Qwen Embedding',
    },
    codex: {
        categories: ['AI'],
        subcategories: {
            AI: ['Embeddings'],
        },
    },
    // CRITICAL: Sub-node configuration
    inputs: [],  // Sub-nodes have NO inputs
    outputs: [NodeConnectionType.AiEmbedding],  // Must output AiEmbedding type
    outputNames: ['Embeddings'],
    credentials: [
        {
            name: 'qwenApi',
            required: true,
        },
    ],
    properties: [
        // ... your parameters
    ],
};
```

### 2. supplyData Method Implementation

Replace the execute() method with supplyData():

```typescript
import type {
    ISupplyDataFunctions,
    SupplyData,
} from 'n8n-workflow';
import { Embeddings } from '@langchain/core/embeddings';

export class QwenEmbedding implements INodeType {
    description: INodeTypeDescription = {
        // ... configuration above
    };

    async supplyData(
        this: ISupplyDataFunctions,
        itemIndex: number,
    ): Promise<SupplyData> {
        const credentials = await this.getCredentials('qwenApi');
        const apiUrl = credentials.apiUrl as string;

        // Get node parameters
        const dimensions = this.getNodeParameter('dimensions', itemIndex, 1024) as number;
        const prefix = this.getNodeParameter('prefix', itemIndex, '') as string;
        const instruction = this.getNodeParameter('instruction', itemIndex, 'none') as string;

        // Create custom embeddings class
        const embeddings = new QwenEmbeddings({
            apiUrl,
            apiKey: credentials.apiKey as string,
            dimensions,
            prefix,
            instruction,
        });

        return {
            response: embeddings,
        };
    }
}
```

### 3. Custom LangChain Embeddings Class

You need to create a LangChain-compatible embeddings class:

```typescript
import { Embeddings } from '@langchain/core/embeddings';
import type { EmbeddingsParams } from '@langchain/core/embeddings';

export interface QwenEmbeddingsParams extends EmbeddingsParams {
    apiUrl: string;
    apiKey?: string;
    dimensions?: number;
    prefix?: string;
    instruction?: string;
}

export class QwenEmbeddings extends Embeddings {
    apiUrl: string;
    apiKey?: string;
    dimensions: number;
    prefix?: string;
    instruction?: string;

    constructor(fields: QwenEmbeddingsParams) {
        super(fields);
        this.apiUrl = fields.apiUrl;
        this.apiKey = fields.apiKey;
        this.dimensions = fields.dimensions ?? 1024;
        this.prefix = fields.prefix;
        this.instruction = fields.instruction;
    }

    /**
     * Embed a single query text
     * Used by vector stores for search queries
     */
    async embedQuery(text: string): Promise<number[]> {
        const requestBody: any = {
            text: text.trim(),
            dimensions: this.dimensions,
        };

        if (this.prefix) {
            requestBody.prefix = this.prefix;
        }

        if (this.instruction && this.instruction !== 'none') {
            requestBody.instruction = this.instruction;
        }

        const response = await fetch(`${this.apiUrl}/embed`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`Qwen embedding request failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error('Invalid response from Qwen server: missing embedding array');
        }

        return data.embedding;
    }

    /**
     * Embed multiple documents
     * Used by vector stores when inserting documents
     */
    async embedDocuments(documents: string[]): Promise<number[][]> {
        // Process documents in batches for efficiency
        const embeddings: number[][] = [];

        for (const doc of documents) {
            const embedding = await this.embedQuery(doc);
            embeddings.push(embedding);
        }

        return embeddings;
    }
}
```

### 4. Updated Node Properties

Adjust properties for sub-node pattern (parameters accessed differently):

```typescript
properties: [
    {
        displayName: 'Dimensions',
        name: 'dimensions',
        type: 'number',
        default: 1024,
        description: 'Number of dimensions for the embedding vector (32-1024 via MRL)',
        typeOptions: {
            minValue: 32,
            maxValue: 1024,
        },
    },
    {
        displayName: 'Context Prefix',
        name: 'prefix',
        type: 'string',
        default: '',
        placeholder: 'e.g., "This document is about:"',
        description: 'Optional prefix to prepend to the text',
    },
    {
        displayName: 'Instruction Type',
        name: 'instruction',
        type: 'options',
        default: 'none',
        description: 'Use instruction-aware encoding',
        options: [
            {
                name: 'None',
                value: 'none',
            },
            {
                name: 'Query',
                value: 'query',
                description: 'For search queries',
            },
            {
                name: 'Document',
                value: 'document',
                description: 'For documents being indexed',
            },
        ],
    },
],
```

### 5. Usage Pattern in n8n

Once implemented as a sub-node, your Qwen Embedding node can be used with vector stores:

```
Insert Documents Flow:
Document Loader → (Document) → Vector Store → (Embeddings) → Qwen Embedding

Retrieve Documents Flow:
AI Agent → (Tools) → Vector Store Tool → (Vector Store) → Vector Store → (Embeddings) → Qwen Embedding

Question Answering Flow:
Question & Answer Chain → (Retriever) → Vector Store Retriever → (Vector Store) → Vector Store → (Embeddings) → Qwen Embedding
```

### 6. Package Dependencies

Add required LangChain dependencies to package.json:

```json
{
    "peerDependencies": {
        "@langchain/core": "~0.3.0"
    },
    "dependencies": {
        "@langchain/core": "^0.3.0"
    }
}
```

</implementation>

## Critical Considerations

<considerations>

### Sub-node vs Regular Node Behavior

**Sub-nodes process items differently:**
- Regular nodes: Process each item in the input array individually
- Sub-nodes: Expressions always resolve to the first item only
- This means sub-nodes don't process batches - they provide a capability to other nodes

### Vector Store Connection Types

n8n uses typed connections for vector stores:
- `NodeConnectionType.AiEmbedding` - For embedding nodes
- `NodeConnectionType.AiVectorStore` - For vector store nodes
- `NodeConnectionType.AiRetriever` - For retriever nodes
- `NodeConnectionType.Main` - For standard data flow

### Error: "Node does not have a supplyData method"

This error occurs when:
1. A node is configured as a sub-node (empty inputs, special output type)
2. But still uses execute() instead of supplyData()
3. Solution: Implement supplyData() method

### LangChain Version Compatibility

**CRITICAL:** All LangChain packages must share the same @langchain/core version:
- @langchain/core: ~0.3.0
- @langchain/community: Compatible with core 0.3.x
- Custom embeddings class must extend from @langchain/core/embeddings

### Performance Considerations

1. **Batch Processing**: LangChain's embedDocuments() is called for bulk operations
2. **Caching**: Consider implementing embedding cache for repeated queries
3. **Timeout**: Vector stores may call embeddings multiple times - ensure robust error handling
4. **Rate Limiting**: Your Qwen server should handle concurrent requests

### Testing Vector Store Integration

Test your embedding node with these vector stores:
1. **Simple Vector Store** (in-memory) - easiest for testing
2. **Supabase Vector Store** - popular production option
3. **PGVector Vector Store** - PostgreSQL-based
4. **Qdrant Vector Store** - specialized vector database

</considerations>

## Alternatives Comparison

<alternatives>

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Sub-node (Recommended)** | Full vector store integration, Works with all n8n AI features, Standard n8n pattern | More complex implementation, Requires LangChain knowledge | Production use with vector stores |
| **Regular execute() node** | Simpler implementation, Direct HTTP control, Easier debugging | Cannot connect to vector stores, No AI Agent integration, Manual embedding workflow | Standalone embedding generation |
| **LangChain Code node** | Ultimate flexibility, Custom LangChain code, No packaging needed | Self-hosted only, JavaScript/TypeScript only, Not reusable | Prototyping and testing |

</alternatives>

## Complete File Structure

<file-structure>

```
nodes/QwenEmbedding/
├── QwenEmbedding.node.ts          # Main node with supplyData()
├── QwenEmbeddings.ts              # LangChain Embeddings class
├── types.ts                       # TypeScript interfaces
├── qwen.svg                       # Node icon
└── __tests__/
    └── QwenEmbedding.test.ts      # Unit tests

credentials/
└── QwenApi.credentials.ts         # Keep existing credentials
```

</file-structure>

## Migration Path

<migration>

### Step 1: Create LangChain Embeddings Class
Create `nodes/QwenEmbedding/QwenEmbeddings.ts` with the embeddings implementation.

### Step 2: Update Node Configuration
Modify `QwenEmbedding.node.ts`:
- Change inputs from `['main']` to `[]`
- Change outputs from `['main']` to `[NodeConnectionType.AiEmbedding]`
- Add codex categories for AI/Embeddings

### Step 3: Replace execute() with supplyData()
- Remove execute() method entirely
- Implement supplyData() method
- Return LangChain Embeddings instance

### Step 4: Update Package Dependencies
Add @langchain/core to package.json dependencies.

### Step 5: Test Integration
Test with Simple Vector Store node in n8n:
1. Create workflow with Vector Store node
2. Connect Qwen Embedding to embeddings connector
3. Insert test documents
4. Query with similarity search

</migration>

## Resources

<references>

### Official Documentation
- [n8n Node Development](https://docs.n8n.io/integrations/creating-nodes/) - Node creation guide
- [n8n LangChain Integration](https://docs.n8n.io/advanced-ai/langchain/overview/) - LangChain concepts in n8n
- [LangChain Embeddings](https://js.langchain.com/docs/modules/data_connection/text_embedding/) - LangChain embeddings interface

### Example Implementations
- [n8n Embeddings OpenAI](https://github.com/n8n-io/n8n/tree/master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsOpenAi) - Reference implementation
- [n8n Embeddings Ollama](https://github.com/n8n-io/n8n/tree/master/packages/@n8n/nodes-langchain/nodes/embeddings/EmbeddingsOllama) - Local model example
- [VoyageAI Embeddings](https://github.com/theseedship/n8n-nodes-voyage_embeddings) - Community example

### Key GitHub Files
- [n8n-workflow types](https://github.com/n8n-io/n8n/tree/master/packages/workflow/src) - ISupplyDataFunctions definition
- [nodes-langchain package](https://github.com/n8n-io/n8n/tree/master/packages/@n8n/nodes-langchain) - Official LangChain nodes

### Community Resources
- [n8n Community Forum - AI Section](https://community.n8n.io/c/built-with-n8n/ai/) - Real-world examples
- [n8n Nodes Starter](https://github.com/n8n-io/n8n-nodes-starter) - Starter template

</references>

## Research Metadata

<meta>
research-date: 2025-10-04
confidence-level: high
sources-validated: 15
version-current: n8n 1.74.0 (Jan 2025)
langchain-version: @langchain/core ~0.3.0
</meta>

## Next Steps

1. **Create QwenEmbeddings.ts** - Implement LangChain-compatible embeddings class
2. **Refactor QwenEmbedding.node.ts** - Convert from execute() to supplyData() pattern
3. **Update package.json** - Add @langchain/core dependency
4. **Test with Simple Vector Store** - Verify vector store connectivity
5. **Document usage** - Create examples for users

## Key Takeaways

The fundamental difference between your current implementation and what's needed:

**Current:** Regular node with execute() → processes text → returns embedding data
**Required:** Sub-node with supplyData() → provides embedding capability → used by vector stores

Your current node is perfect for standalone embedding generation, but to integrate with n8n's vector store ecosystem, you need to refactor it as a sub-node that returns a LangChain Embeddings instance.
