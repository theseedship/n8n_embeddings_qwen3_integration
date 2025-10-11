# Testing n8n Node Updates

## ⚠️ IMPORTANT: Clear n8n Cache

When updating node packages, n8n caches the node definitions. You **MUST** clear the cache for changes to take effect.

### Method 1: Restart n8n (Recommended)
```bash
# Stop n8n
# Then start it again
n8n start
```

### Method 2: Clear n8n cache directory
```bash
# Delete n8n cache
rm -rf ~/.n8n/cache/*
rm -rf ~/.n8n/.cache/*

# Then restart n8n
```

### Method 3: Force reinstall package in n8n
```bash
# In n8n settings > Community Nodes
# 1. Uninstall: n8n-nodes-qwen-embedding
# 2. Wait for confirmation
# 3. Reinstall: n8n-nodes-qwen-embedding@0.8.8
```

### Method 4: Docker restart (if using Docker)
```bash
docker-compose down
docker-compose up -d
```

## 🧪 Testing Checklist v0.8.8

### Test 1: Custom Timeout Field Visibility
1. Add "Ollama Embeddings Tool" node to workflow
2. Click on "Options" → "Add Option"
3. Select "Performance Mode"
4. Change from "GPU Optimized" to **"Custom"**
5. ✅ **Expected**: "Custom Timeout (Ms)" and "Max Retries" fields should appear immediately
6. ❌ **If fields don't appear**: Cache not cleared, restart n8n

### Test 2: Compact Format Output
1. Add "Ollama Embeddings Tool" node
2. In Options, enable "Compact Format"
3. Execute the node with text: "Hello world"
4. Check output for field: `embeddingCompact`
5. ✅ **Expected format**: `0.123;-0.456;0.789;0.012;-0.345;...` (semicolon-separated, ONE line)
6. ❌ **If vertical list**: Something is still wrong with n8n's auto-formatting

### Test 3: Performance Mode Works
1. Set Performance Mode to "GPU Optimized" → should use 30s timeout, 2 retries
2. Set Performance Mode to "CPU Optimized" → should use 120s timeout, 3 retries
3. Set Performance Mode to "Custom" → should allow manual timeout/retry input

## 📝 Current Version Features

**v0.8.8 Changes:**
- Fixed displayOptions path for Custom Timeout visibility
- Changed compact format from comma (`,`) to semicolon (`;`) separator
- Removed unreliable auto-detect mode
- Improved field ordering for better UX

**Compact Format Output:**
- Single embedding: `embeddingCompact` field with semicolon-separated values
- Batch embeddings: `embeddingsCompact` field with one embedding per line, semicolon-separated

## 🐛 Troubleshooting

### Issue: Custom Timeout field not appearing
**Cause**: n8n cache not cleared
**Solution**:
1. Completely close n8n
2. Delete `~/.n8n/cache/*`
3. Restart n8n
4. Refresh browser (Ctrl+F5)

### Issue: Compact format still shows vertical list
**Possible causes**:
1. n8n's JSON renderer auto-detects the format
2. Browser cache (try incognito mode)
3. Old package version still loaded

**Next steps to try**:
1. Verify package version in n8n: Settings > Community Nodes
2. Check field name is `embeddingCompact` (not `embedding`)
3. Try different separators: pipe `|`, space ` `, tab `\t`

### Issue: Changes not reflected at all
**Cause**: npm package not updated yet
**Solution**: Wait 5-10 minutes for GitHub Actions to publish to npm, then reinstall package

## 📊 Debug Output

To verify what n8n receives, check the raw JSON output:
1. Execute node
2. Click "JSON" tab in output panel
3. Look for `embeddingCompact` field
4. Copy value and check separator character

Example expected output:
```json
{
  "embedding": [0.123, -0.456, 0.789, ...],
  "embeddingCompact": "0.123;-0.456;0.789;...",
  "dimensions": 1024,
  "text": "Hello world",
  "model": "qwen3-embedding:0.6b"
}
```
