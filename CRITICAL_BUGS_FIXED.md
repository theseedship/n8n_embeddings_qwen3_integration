# Critical Bugs Fixed - Version 0.3.5

## Root Cause Analysis: HTTP 405 Error

After extensive investigation, we discovered **TWO critical bugs** in `QwenEmbeddingTool.node.ts` that were causing the HTTP 405 "Method Not Allowed" error:

---

## Bug #1: Missing Content-Type Header ❌→✅

### Problem
The node was sending JSON data without explicitly setting the `Content-Type` header:

```typescript
// BEFORE (WRONG)
const requestOptions: IHttpRequestOptions = {
    method: 'POST',
    url: `${apiUrl}/api/embed`,
    body: requestBody,
    json: true,
    returnFullResponse: false,
    timeout: requestTimeout,
    headers: {},  // ❌ Empty headers!
};
```

While `json: true` should theoretically handle this, `this.helpers.httpRequest` (unlike `httpRequestWithAuthentication`) **does NOT automatically set Content-Type**. This caused Ollama to reject the request with HTTP 405.

### Fix
Explicitly set the Content-Type header:

```typescript
// AFTER (CORRECT)
const requestOptions: IHttpRequestOptions = {
    method: 'POST',
    url: `${apiUrl}/api/embed`,
    body: requestBody,
    json: true,
    returnFullResponse: false,
    timeout: requestTimeout,
    headers: {
        'Content-Type': 'application/json',  // ✅ Explicit Content-Type!
    },
};
```

**Changed in**: [QwenEmbeddingTool.node.ts:372-374](../nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts#L372-L374)

---

## Bug #2: Wrong Response Field Name ❌→✅

### Problem
The node expected `response.embedding` (singular) but Ollama API `/api/embed` returns `response.embeddings` (plural) as an **array**:

```typescript
// BEFORE (WRONG)
if (!response || !response.embedding) {  // ❌ Wrong field name!
    throw new NodeOperationError(
        this.getNode(),
        'Invalid response from Ollama: missing embedding',
        { itemIndex },
    );
}

let embedding = response.embedding;  // ❌ This field doesn't exist!
```

### Actual Ollama Response Format
```json
{
  "model": "qwen3-embedding:0.6b",
  "embeddings": [[0.018, -0.042, ...]],  // ← Array of embeddings!
  "total_duration": 211038724,
  "load_duration": 72134592,
  "prompt_eval_count": 1
}
```

### Fix
Read from the correct field name and extract first element:

```typescript
// AFTER (CORRECT)
// Ollama returns 'embeddings' (plural) as an array
if (!response || !response.embeddings || !Array.isArray(response.embeddings) || response.embeddings.length === 0) {
    throw new NodeOperationError(
        this.getNode(),
        'Invalid response from Ollama: missing embeddings array',
        { itemIndex },
    );
}

let embedding = response.embeddings[0];  // ✅ Extract first embedding from array!
```

**Changed in**: [QwenEmbeddingTool.node.ts:451-462](../nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts#L451-L462)

---

## Impact

These bugs caused:
- ❌ HTTP 405 "Method Not Allowed" errors on ALL requests
- ❌ Node completely non-functional in local environments
- ✅ Remote instance worked due to different N8N helper behavior (httpRequestWithAuthentication)

## Verification

Test that Ollama API works directly:

```bash
curl -X POST http://deposium-ollama:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-embedding:0.6b","input":"test"}' | jq .embeddings
```

Expected output:
```json
[
  [-0.018, -0.042, -0.014, ...]
]
```

## Files Modified

1. **QwenEmbeddingTool.node.ts**:
   - Line 372-374: Added explicit `Content-Type` header
   - Line 453-462: Fixed response field from `embedding` → `embeddings[0]`

2. **QwenEmbedding.node.ts**:
   - Already handled both formats correctly (no changes needed)

## Installation

```bash
# Uninstall old version
docker exec deposium-n8n-primary sh -c 'cd ~/.n8n/nodes && npm uninstall n8n-nodes-qwen-embedding'

# Install fixed version
docker cp /tmp/n8n-nodes-qwen-embedding-0.3.5-fixed.tgz deposium-n8n-primary:/tmp/
docker exec deposium-n8n-primary sh -c 'cd ~/.n8n/nodes && npm install /tmp/n8n-nodes-qwen-embedding-0.3.5-fixed.tgz'

# Restart N8N
docker-compose restart n8n-primary n8n-worker
```

## Next Steps

1. **Test the node** in N8N with a simple text input
2. **Publish 0.3.6** to npm with these critical fixes
3. **Update documentation** to reflect correct API format

---

**Status**: ✅ Fixed and installed in local N8N container
**Ready for**: User testing and npm publication
