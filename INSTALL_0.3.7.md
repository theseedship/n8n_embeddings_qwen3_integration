# Installation Guide - Version 0.3.7

## 🚀 Critical HTTP 405 Fix Released!

Version 0.3.7 has been published to npm with the complete fix for the HTTP 405 "Method Not Allowed" error.

---

## 📋 Installation Steps

### Step 1: Uninstall Current Version

**Via N8N UI:**
1. Go to `Settings` → `Community Nodes`
2. Find `n8n-nodes-qwen-embedding`
3. Click `Uninstall`
4. Wait for uninstall to complete

**Or via Command Line:**
```bash
docker exec deposium-n8n-primary sh -c 'cd ~/.n8n/nodes && npm uninstall n8n-nodes-qwen-embedding'
```

---

### Step 2: Wait for npm Propagation

**Wait 2-3 minutes** after GitHub Actions completes to ensure version 0.3.7 is available on npm registry.

**Check npm availability:**
```bash
npm view n8n-nodes-qwen-embedding version
# Should show: 0.3.7
```

---

### Step 3: Install Version 0.3.7

**Via N8N UI (Recommended):**
1. Go to `Settings` → `Community Nodes`
2. Click `Install`
3. Enter package name: `n8n-nodes-qwen-embedding`
4. Click `Install`
5. Wait for installation to complete

**Or via Command Line:**
```bash
docker exec deposium-n8n-primary sh -c 'cd ~/.n8n/nodes && npm install n8n-nodes-qwen-embedding@0.3.7'
```

---

### Step 4: Restart N8N Services

```bash
cd /home/nico/code_source/tss/deposium_fullstack/deposium-local
docker-compose restart n8n-primary n8n-worker
```

**Wait 30-60 seconds** for services to fully restart.

---

### Step 5: Verify Installation

**Check installed version in container:**
```bash
docker exec deposium-n8n-primary sh -c 'cat ~/.n8n/nodes/node_modules/n8n-nodes-qwen-embedding/package.json | grep version'
# Should show: "version": "0.3.7"
```

**Check N8N UI:**
1. Go to `Settings` → `Community Nodes`
2. Verify `n8n-nodes-qwen-embedding` shows version `0.3.7`

---

### Step 6: Test the Node

1. Create new workflow or open existing one
2. Add "Qwen Embedding Tool" node
3. Configure:
   - **Ollama URL:** `http://deposium-ollama:11434`
   - **Model:** `qwen3-embedding:0.6b`
   - **Text:** `Hello world`
4. Click `Execute Node`

**Expected Result:** ✅ Embedding array returned (512 dimensions)

**Before 0.3.7:** ❌ HTTP 405 error

---

## 🔍 Troubleshooting

### If Still Getting HTTP 405

**Check Ollama logs:**
```bash
docker logs deposium-ollama --tail 20 | grep embed
```

**Should see:**
```
[GIN] | 200 | POST "/api/embed"  ← Correct!
```

**If seeing GET instead of POST:**
```
[GIN] | 405 | GET "/api/embed"   ← Old version still loaded
```

**Solution:** Clear N8N cache and reinstall:
```bash
# Remove all custom nodes
docker exec deposium-n8n-primary sh -c 'rm -rf ~/.n8n/nodes/node_modules'

# Reinstall from npm
docker exec deposium-n8n-primary sh -c 'cd ~/.n8n/nodes && npm install n8n-nodes-qwen-embedding@0.3.7'

# Restart N8N
docker-compose restart n8n-primary n8n-worker
```

---

### If Version Shows 0.3.6 in UI

This is likely a **UI cache issue**. The actual installed version is what matters.

**Verify actual version:**
```bash
docker exec deposium-n8n-primary sh -c 'cat ~/.n8n/nodes/node_modules/n8n-nodes-qwen-embedding/package.json | grep version'
```

If this shows `0.3.7`, the fix is installed correctly even if UI shows `0.3.6`.

---

### If Using QwenEmbedding (LangChain) Node

The "Qwen Embedding" node (LangChain-compatible) uses `fetch()` and was already working correctly.

Only "Qwen Embedding Tool" was affected by the HTTP 405 bug.

---

## 📊 What Was Fixed in 0.3.7

### Bug #1: POST → GET Transformation
N8N's `httpRequest` was converting POST requests to GET when `json: true` was used with raw object body.

**Fix:** `body: JSON.stringify(requestBody)`

### Bug #2: Wrong Response Field
Code expected `response.embedding` but Ollama returns `response.embeddings[0]`.

**Fix:** Changed to `response.embeddings[0]`

### Bug #3: Missing Content-Type
`httpRequest` doesn't auto-set Content-Type like `httpRequestWithAuthentication`.

**Fix:** Added explicit `'Content-Type': 'application/json'` header

---

## 📝 Verification Commands

**Check GitHub Actions workflow:**
https://github.com/theseedship/deposium_n8n_embeddings_integration/actions

**Check npm package:**
https://www.npmjs.com/package/n8n-nodes-qwen-embedding

**Check Ollama is running:**
```bash
docker exec deposium-ollama ollama list
# Should show qwen3-embedding:0.6b
```

**Test Ollama API directly:**
```bash
docker run --rm --network deposium-local_deposium-internal curlimages/curl:latest \
  -X POST http://deposium-ollama:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3-embedding:0.6b","input":"test"}'
# Should return embeddings array
```

---

## 🎯 Success Criteria

✅ N8N shows version 0.3.7 (or container has 0.3.7 installed)
✅ Ollama logs show POST requests (not GET)
✅ Node executes without HTTP 405 error
✅ Embedding array is returned successfully

---

## 📞 Support

If issues persist after following all steps:
1. Capture Ollama logs during node execution
2. Capture N8N logs: `docker logs deposium-n8n-primary --tail 100`
3. Share exact error message and configuration

---

**Documentation:**
- [CHANGELOG_0.3.7.md](./CHANGELOG_0.3.7.md) - Complete changelog
- [HTTP_405_ROOT_CAUSE.md](./HTTP_405_ROOT_CAUSE.md) - Root cause analysis
- [CRITICAL_BUGS_FIXED.md](./CRITICAL_BUGS_FIXED.md) - Technical details
