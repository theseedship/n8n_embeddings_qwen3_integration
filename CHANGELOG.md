# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.5] - 2025-10-07

### Added

- **Performance Mode with Auto-Detection**: Smart timeout and retry configuration
  - `Auto-Detect`: Automatically detects GPU/CPU on first request and adjusts timeout
    - GPU detected (<1s response): 10s timeout, 2 retries
    - CPU detected (>5s response): 60s timeout, 3 retries
  - `GPU Optimized`: Manual setting for GPU hardware (10s timeout, 2 retries)
  - `CPU Optimized`: Manual setting for CPU hardware (60s timeout, 3 retries)
  - `Custom`: User-defined timeout and retry settings
  - Impact: Eliminates timeout errors on CPU while maintaining fast GPU performance

- **Retry Logic with Exponential Backoff**: Automatic retry on transient failures
  - Exponential backoff: 1s → 2s → 4s → 5s (capped)
  - Configurable max retries (0-5, default 2)
  - Clear console logging for debugging
  - Impact: Handles network issues and temporary Ollama unavailability gracefully

- **Dynamic Timeout Adjustment**: Timeout auto-adjusts based on detected hardware
  - First request measures actual performance
  - Subsequent requests use optimized timeout
  - Prevents unnecessary waiting on fast hardware
  - Prevents premature timeouts on slow hardware

### Improved

- **QwenEmbeddingTool Node**: All performance enhancements applied
  - Better error messages with retry count context
  - Console logging for auto-detection events
  - Hardware-aware default configurations

### Technical Details

**Auto-Detection Algorithm:**
```
1. First request measures duration
2. If duration < 1s → GPU detected → timeout = 10s
3. If duration > 5s → CPU detected → timeout = 60s
4. If 1s ≤ duration ≤ 5s → keep default 30s
5. Apply new settings to subsequent requests
```

**Retry Backoff Strategy:**
```
Attempt 1: Wait 1s  (2^0 × 1000ms)
Attempt 2: Wait 2s  (2^1 × 1000ms)
Attempt 3: Wait 4s  (2^2 × 1000ms)
Attempt 4+: Wait 5s (capped at 5000ms)
```

## [0.3.4] - 2025-10-07

### Fixed (CRITICAL - P0 Blocker Bugs)

- **HTTP 405 Error Fixed**: Corrected API endpoint from `/api/embeddings` (plural) to `/api/embed` (singular)
  - Previous: `url: ${apiUrl}/api/embeddings`
  - Fixed: `url: ${apiUrl}/api/embed`
  - Impact: Resolves "Method not allowed" errors preventing node from functioning

- **Request Body Fixed**: Changed request field from `prompt` to `input`
  - Previous: `prompt: text // Ollama uses 'prompt' not 'input'`
  - Fixed: `input: text // Ollama API expects 'input' field for embeddings`
  - Impact: Correct API format matching Ollama embedding spec

- **Default Model Fixed**: Updated default model to Ollama format
  - Previous: `Qwen/Qwen3-Embedding-0.6B` (HuggingFace format)
  - Fixed: `qwen3-embedding:0.6b` (Ollama format)
  - Impact: Node works out-of-the-box without model not found errors

### Added

- **Husky Pre-commit Hooks**: Automated code quality checks before each commit
  - Prettier formatting
  - ESLint linting
  - TypeScript build validation
  - Prevents broken code from being committed

### Documentation

- Added `BUGS_IDENTIFIED.md` with comprehensive bug analysis
- Updated placeholder examples to show correct Ollama model names
- Corrected misleading comment about Ollama API format

### References

- Ollama API Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings
- Bug Reports: https://github.com/theseedship/deposium_n8n_embeddings_integration/issues

## [0.3.2] - Previous Release

See Git history for previous changes.

---

## Migration Guide: 0.3.2 → 0.3.4

### Breaking Changes

None - all fixes are backward compatible.

### Recommended Actions

1. **Update node package**: `npm update n8n-nodes-qwen-embedding`
2. **Update workflows**: Change model name from `Qwen/Qwen3-Embedding-0.6B` to `qwen3-embedding:0.6b`
3. **Verify Ollama**: Ensure `ollama pull qwen3-embedding:0.6b` has been run
4. **Test**: Re-run existing workflows to confirm fixes resolved issues

### What's Fixed

**Before (0.3.2):**
```
Error: HTTP 405 Method Not Allowed
The connection was aborted, perhaps the server is offline
```

**After (0.3.4):**
```
✅ Embeddings generated successfully
⚡ Response time: ~200ms (with GPU)
🌍 Multilingual support: 100+ languages
```

### GPU Performance

With NVIDIA GPU support (requires nvidia-docker runtime):
- Embedding generation: **150-220ms** per request
- Model loading: ~3 seconds (one-time)
- VRAM usage: ~800MB for qwen3-embedding:0.6b

See [OLLAMA_GPU_N8N.md](../deposium-local/docs/OLLAMA_GPU_N8N.md) for GPU setup guide.

---

## Support

- **Issues**: https://github.com/theseedship/deposium_n8n_embeddings_integration/issues
- **Documentation**: See README.md
- **Ollama Setup**: See DOCKER_SETUP.md

## Contributors

- Bug fixes and pre-commit hooks: Claude Code (Anthropic)
- Original development: Gabriel Zimmermann (@gabzim)
