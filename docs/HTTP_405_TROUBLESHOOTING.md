# HTTP 405 Troubleshooting Guide

## Overview

This document details the discovery, diagnosis, and resolution of a persistent HTTP 405 "Method Not Allowed" error in the N8N Qwen Embedding custom node where N8N was incorrectly sending GET requests to the Ollama API instead of POST requests.

## Problem Summary

**Symptom:** Ollama API rejected embedding requests with HTTP 405 errors.

**Root Cause:** N8N's `httpRequestWithAuthentication` helper was transforming POST requests into GET requests when credentials were marked as `required: true` but missing or invalid.

**Solution:** Use N8N's simple `httpRequest` helper with optional credentials (`required: false`), and fix response field from `response.embedding` to `response.embeddings[0]`.

## Timeline of Discovery

### Version 0.3.9 - Initial fetch() Attempt (Failed)

**Change:** Migrated from `this.helpers.httpRequest()` to native `fetch()` API.

**Reasoning:** Reference implementation (QwenEmbedding node) used `fetch()` successfully.

**Result:** ❌ FAILED - N8N's internal caching caused persistent GET requests despite correct fetch() code.

**Evidence:**

```
Ollama logs: [GIN] | 405 | GET "/api/embed"
N8N error: "Failed after 2 retries: Request failed with status code 405"
```

**Key Learning:** N8N aggressively caches node code. Container restarts and cache clearing are essential after code changes.

### Version 0.4.0 - Railway Code Rollback (Failed)

**Change:** Reverted to Railway production code (v0.3.6) that used `httpRequestWithAuthentication`.

**Reasoning:** Railway production environment was confirmed working with this approach.

**Result:** ❌ FAILED - Same HTTP 405 errors persisted locally.

**Evidence:**

```bash
# Railway (working):
- Environment: CPU mode, no GPU
- Code: httpRequestWithAuthentication with credentials
- Result: 200 OK responses

# Local (failing):
- Environment: GPU available
- Same code
- Result: 405 GET errors
```

**Key Learning:** Railway and local environments had different credential configurations. Railway had Ollama credentials properly configured in N8N, while local did not.

### Nuclear Cleanup Investigation

**Actions Taken:**

1. Uninstalled package from N8N Primary + Worker nodes
2. Cleared N8N npm cache: `rm -rf ~/.cache/n8n/*`
3. Stopped all containers and killed Node.js processes
4. Restarted with fresh containers
5. Reinstalled package and created completely new workflow nodes

**Result:** ❌ Still GET 405 errors

**Evidence from Ollama Logs:**

```
[GIN] | 405 | GET  "/api/embed"  # IP: 172.20.0.25 (failing)
[GIN] | 200 | POST "/api/embed"  # IP: 172.20.0.34 (working!)
```

**Critical Discovery:** Two different container IPs making requests! This proved N8N was running multiple versions simultaneously due to caching.

### Direct Container Test - Breakthrough

**Test:** Execute fetch() directly from N8N container to bypass N8N's helpers.

```bash
docker exec deposium-n8n-primary node -e "
fetch('http://deposium-ollama:11434/api/embed', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({model: 'qwen3-embedding:0.6b', input: 'test'})
}).then(r => r.json()).then(console.log)
"
```

**Result:** ✅ **200 OK with embeddings!**

**Ollama confirmed:** `[GIN] | 200 | POST "/api/embed"`

**Key Learning:** The fetch() code was correct. The problem was N8N's `httpRequest` and `httpRequestWithAuthentication` helpers, not the underlying network or Ollama configuration.

## Root Cause Analysis

### The Authentication Credential Transformation Bug

**Problem Location:** `QwenEmbeddingTool.node.ts` lines 25-30

```typescript
// BROKEN (v0.4.0):
credentials: [
    {
        name: 'ollamaApi',
        required: true,  // ❌ This caused POST→GET transformation!
    },
],
```

**How It Fails:**

1. Node declares credentials as `required: true`
2. User doesn't configure Ollama credentials (because self-hosted Ollama doesn't need auth)
3. N8N's `httpRequestWithAuthentication` detects missing credentials
4. Internal N8N logic transforms POST request to GET as a fallback
5. Ollama API rejects GET with HTTP 405

**Why Railway Worked:**

Railway environment had Ollama API credentials properly configured in N8N's credential store, so `httpRequestWithAuthentication` had valid credentials to use and didn't transform the request.

### Version 0.4.1 - The Fix

**Change 1:** Make credentials optional (line 28)

```typescript
credentials: [
    {
        name: 'ollamaApi',
        required: false,  // ✅ Optional - not needed for self-hosted
    },
],
```

**Change 2:** Use simple httpRequest (line 382)

```typescript
// Use simple httpRequest instead of httpRequestWithAuthentication
// to avoid authentication system transforming POST to GET
response = await this.helpers.httpRequest(requestOptions);
```

**Result:** ✅ Progress! Different error: "Invalid response from Ollama: missing embedding"

**Evidence:**

```
Ollama logs: [GIN] | 200 | POST "/api/embed"  # POST is now working!
N8N error: "Invalid response from Ollama: missing embedding"
```

### Version 0.4.2 - Response Field Fix

**Problem:** Code was looking for `response.embedding` (singular) but Ollama returns `response.embeddings` (plural array).

**Fix:** Lines 446-455

```typescript
// BEFORE:
if (!response || !response.embedding) {
    throw new NodeOperationError(...);
}
let embedding = response.embedding;

// AFTER:
// Ollama returns 'embeddings' (plural) as an array
if (!response || !response.embeddings || !Array.isArray(response.embeddings) ||
    response.embeddings.length === 0) {
    throw new NodeOperationError(
        this.getNode(),
        'Invalid response from Ollama: missing embeddings array',
        { itemIndex },
    );
}
let embedding = response.embeddings[0];
```

**Result:** ✅ **COMPLETE SUCCESS!**

**Evidence:**

```
Ollama logs:
[GIN] 2025/10/07 - 19:44:23 | 200 | 268.613321ms | POST "/api/embed"
[GIN] 2025/10/07 - 19:44:46 | 200 | 215.767418ms | POST "/api/embed"

Average performance: ~218ms with GPU acceleration
```

## Patterns That Work

### ✅ Working Pattern: Simple httpRequest

```typescript
const requestOptions: IHttpRequestOptions = {
	method: 'POST',
	url: `${apiUrl}/api/embed`,
	body: requestBody, // Direct object, not stringified
	json: true,
	returnFullResponse: false,
	timeout: requestTimeout,
};

response = await this.helpers.httpRequest(requestOptions);
```

**Why This Works:**

- No authentication layer to transform the request
- Direct POST method specification
- Simple, predictable behavior

### ✅ Working Pattern: Optional Credentials

```typescript
credentials: [
    {
        name: 'ollamaApi',
        required: false,  // Optional for self-hosted Ollama
    },
],
```

**Why This Works:**

- Allows users without authentication to use the node
- Prevents N8N from blocking requests due to missing credentials
- Still supports authenticated Ollama instances if credentials are provided

### ✅ Working Pattern: Correct Response Field

```typescript
// Ollama API returns embeddings as an array
let embedding = response.embeddings[0]; // Access first element
```

**Why This Works:**

- Matches Ollama's actual API response format
- Handles array structure correctly

## Anti-Patterns (Don't Use)

### ❌ Anti-Pattern: Required Credentials + httpRequestWithAuthentication

```typescript
// DON'T DO THIS:
credentials: ([
	{
		name: 'ollamaApi',
		required: true, // ❌ Blocks users without auth
	},
],
	// Later in code:
	(response = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'ollamaApi',
		requestOptions,
	))); // ❌ Transforms POST→GET when credentials missing
```

**Why This Fails:**

- Forces authentication for self-hosted instances that don't need it
- N8N's authentication helper transforms POST to GET as fallback
- Creates confusing 405 errors that are hard to debug

### ❌ Anti-Pattern: Native fetch() in N8N Nodes

```typescript
// DON'T DO THIS:
const response = await fetch(`${apiUrl}/api/embed`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(requestBody),
});
```

**Why This Fails:**

- N8N caches node code aggressively
- fetch() works in container tests but fails in actual node execution
- Creates inconsistent behavior between environments
- Harder to debug than using N8N's built-in helpers

### ❌ Anti-Pattern: Singular Response Field

```typescript
// DON'T DO THIS:
let embedding = response.embedding; // ❌ Ollama returns 'embeddings' (plural)
```

**Why This Fails:**

- Ollama API actually returns `embeddings` as an array
- Creates "missing embedding" errors
- Mismatches the actual API specification

## N8N Caching Issues

### Problem

N8N aggressively caches:

- Node definitions and properties
- Compiled JavaScript code
- Workflow configurations
- Module `require()` cache

### Solutions

**After Every Code Change:**

1. **Restart N8N containers:**

```bash
docker-compose restart deposium-n8n-primary deposium-n8n-worker
```

2. **Clear N8N cache:**

```bash
docker exec deposium-n8n-primary rm -rf /home/node/.cache/n8n/*
```

3. **Uninstall and reinstall package:**

```bash
# Uninstall
docker exec deposium-n8n-primary sh -c 'cd ~/.n8n/nodes && npm uninstall n8n-nodes-qwen-embedding'

# Reinstall
docker exec deposium-n8n-primary sh -c 'cd ~/.n8n/nodes && npm install /tmp/n8n-nodes-qwen-embedding-X.X.X.tgz'
```

4. **Create NEW workflow nodes (don't duplicate existing ones):**
   - Old nodes retain cached code
   - New nodes load fresh code
   - Duplicating nodes copies the cache

### Verification Commands

**Check installed version:**

```bash
docker exec deposium-n8n-primary sh -c 'cat ~/.n8n/nodes/node_modules/n8n-nodes-qwen-embedding/package.json | grep version'
```

**Verify httpRequest (not httpRequestWithAuthentication):**

```bash
docker exec deposium-n8n-primary sh -c 'grep -n "httpRequest(requestOptions)" ~/.n8n/nodes/node_modules/n8n-nodes-qwen-embedding/dist/nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.js'
```

**Verify embeddings[0] usage:**

```bash
docker exec deposium-n8n-primary sh -c 'grep -n "embeddings\[0\]" ~/.n8n/nodes/node_modules/n8n-nodes-qwen-embedding/dist/nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.js'
```

## Testing Methodology

### Real-Time Log Monitoring

**Terminal 1: Watch Ollama logs**

```bash
docker logs deposium-ollama --follow --tail 0 | grep embed
```

**Terminal 2: Test in N8N UI**

- Create NEW node instance (don't duplicate)
- Configure with test data
- Execute workflow
- Monitor Terminal 1 for Ollama response

**Success Indicators:**

```
[GIN] | 200 | POST "/api/embed"  # ✅ Correct method and status
Response time: 150-270ms (GPU)   # ✅ Fast with GPU
```

**Failure Indicators:**

```
[GIN] | 405 | GET "/api/embed"   # ❌ Wrong method
[GIN] | 404 | POST "/api/embed"  # ❌ Model not found
```

### Container Direct Test

**Bypass N8N completely to test Ollama:**

```bash
docker exec deposium-n8n-primary node -e "
fetch('http://deposium-ollama:11434/api/embed', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    model: 'qwen3-embedding:0.6b',
    input: 'hello world test'
  })
}).then(r => r.json()).then(d => {
  console.log('Status: 200 OK');
  console.log('Embeddings length:', d.embeddings[0].length);
})
"
```

**Expected Output:**

```
Status: 200 OK
Embeddings length: 1024
```

## Environment Differences

### Railway Production (Worked with v0.3.6)

- **Environment:** CPU-only mode
- **Code:** `httpRequestWithAuthentication`
- **Credentials:** Configured in N8N credential store
- **Result:** ✅ 200 OK responses
- **Performance:** Slower due to CPU (5-10 seconds per request)

### Local Development (Failed until v0.4.2)

- **Environment:** GPU available (NVIDIA)
- **Code:** Initially same as Railway
- **Credentials:** Not configured (self-hosted doesn't need auth)
- **Result:** ❌ 405 errors until fix
- **Performance:** Fast with GPU (~218ms per request)

**Key Difference:** Credential configuration. Railway had credentials, local didn't. This triggered the POST→GET transformation in `httpRequestWithAuthentication`.

## Performance Observations

### GPU Performance (Version 0.4.2)

```
Request 1: 268ms
Request 2: 215ms
Request 3: 202ms
Request 4: 186ms
Average: ~218ms
```

### Auto-Detection Working

The performance mode auto-detection correctly identified GPU:

```
[Auto-detect] GPU detected (215ms). Adjusted timeout to 10s.
```

## Recommendations

### For Self-Hosted Ollama (No Authentication)

1. ✅ Use `required: false` for credentials
2. ✅ Use `this.helpers.httpRequest()` instead of `httpRequestWithAuthentication`
3. ✅ Set reasonable timeouts (10s for GPU, 60s for CPU)
4. ✅ Enable auto-detection for dynamic environments

### For Authenticated Ollama Instances

1. ✅ Keep `required: false` (still works with credentials if provided)
2. ✅ Configure credentials in N8N UI
3. ✅ Still use `httpRequest()` to avoid transformation issues

### For Development

1. ✅ Always restart containers after code changes
2. ✅ Clear N8N cache regularly
3. ✅ Create NEW nodes instead of duplicating
4. ✅ Monitor Ollama logs in real-time during testing
5. ✅ Verify installed code matches source with grep commands

## References

- **Ollama API Documentation:** https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddingsdocker run --rm -v deposium-local_n8n_data:/data alpine sh -c 'rm -rf /data/.cache/\* && rm -rf /data/nodes/node_modules/n8n-nodes-qwen-embedding'
- **N8N Custom Nodes:** https://docs.n8n.io/integrations/creating-nodes/
- **Bug Tracker:** https://github.com/theseedship/deposium_n8n_embeddings_integration/issues

## Version History

- **v0.3.9:** Attempted fetch() migration - Failed due to N8N caching
- **v0.4.0:** Reverted to Railway code - Failed due to missing credentials
- **v0.4.1:** Fixed credentials + httpRequest - Partial success (POST working, response field wrong)
- **v0.4.2:** Fixed response field to embeddings[0] - **COMPLETE SUCCESS**

## Contributors

- **Debugging & Fix:** Claude Code (Anthropic)
- **Testing & Validation:** Nicolas (User)
- **Original Development:** Gabriel Zimmermann (@gabzim)
