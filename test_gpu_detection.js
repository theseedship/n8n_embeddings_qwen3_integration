#!/usr/bin/env node

/**
 * Diagnostic script for GPU detection and performance issues
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Different text lengths to test
const TEST_TEXTS = {
    short: 'Quick test',
    medium: 'This is a medium length text that should take a bit more time to process and generate embeddings for testing purposes',
    long: `This is a much longer text that contains multiple sentences and paragraphs to really test the performance of the embedding generation.
           When processing longer texts, the GPU vs CPU difference becomes much more apparent. We need to ensure that the auto-detection
           logic takes into account the length of the text being processed, not just the raw timing. This text should be long enough
           to show real performance differences between GPU and CPU processing. Let's add even more content here to make sure we're
           testing with a realistic amount of text that users might actually want to embed in their applications.`,
    very_long: `${Array(10).fill(`This is a paragraph of text that will be repeated multiple times to create a very long input.
           The purpose is to stress test the embedding generation and see how it performs with large amounts of text.
           We want to see if there are timeout issues or if the performance degrades significantly with longer inputs.`).join(' ')}`
};

async function checkOllamaInfo() {
    console.log('🔍 Checking Ollama Configuration');
    console.log('=' .repeat(60));

    try {
        // Get Ollama version info
        const versionResponse = await fetch(`${OLLAMA_URL}/api/version`);
        if (versionResponse.ok) {
            const version = await versionResponse.json();
            console.log('Ollama Version:', JSON.stringify(version, null, 2));
        }

        // Check available models
        const tagsResponse = await fetch(`${OLLAMA_URL}/api/tags`);
        const tags = await tagsResponse.json();
        const embeddingModels = tags.models?.filter(m =>
            m.name.includes('embed') ||
            m.name.includes('qwen3-embedding') ||
            m.name.includes('gemma')
        );

        console.log('\n📦 Available Embedding Models:');
        embeddingModels?.forEach(model => {
            console.log(`  - ${model.name} (${Math.round(model.size / 1024 / 1024)}MB)`);
        });

        // Try to detect if GPU is available (this is tricky)
        console.log('\n🎮 GPU Detection:');
        console.log('  Note: Ollama API doesn\'t expose GPU info directly');
        console.log('  We can only infer from performance...');

        // Check environment variables
        console.log('\n🌍 Environment Variables:');
        console.log('  CUDA_VISIBLE_DEVICES:', process.env.CUDA_VISIBLE_DEVICES || 'not set');
        console.log('  NVIDIA_VISIBLE_DEVICES:', process.env.NVIDIA_VISIBLE_DEVICES || 'not set');
        console.log('  OLLAMA_HOST:', process.env.OLLAMA_HOST || 'not set');
        console.log('  OLLAMA_GPU:', process.env.OLLAMA_GPU || 'not set');

    } catch (error) {
        console.error('❌ Error getting Ollama info:', error.message);
    }
}

async function testPerformance(model, textKey) {
    const text = TEST_TEXTS[textKey];
    const body = {
        model: model,
        input: text
    };

    const start = Date.now();

    try {
        const response = await fetch(`${OLLAMA_URL}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const duration = Date.now() - start;

        if (!response.ok) {
            return { success: false, duration: 0, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const dims = data.embeddings?.[0]?.length || 0;

        return {
            success: true,
            duration: duration,
            dimensions: dims,
            textLength: text.length,
            msPerChar: duration / text.length
        };
    } catch (error) {
        return { success: false, duration: 0, error: error.message };
    }
}

async function runPerformanceTests() {
    console.log('\n\n⚡ Performance Testing');
    console.log('=' .repeat(60));

    const models = ['qwen3-embedding:0.6b', 'embeddinggemma:300m'];

    for (const model of models) {
        console.log(`\n📊 Testing ${model}:`);
        console.log('-'.repeat(50));

        // Check if model exists
        try {
            const tagsResponse = await fetch(`${OLLAMA_URL}/api/tags`);
            const tags = await tagsResponse.json();
            if (!tags.models?.some(m => m.name === model)) {
                console.log('  ⚠️  Model not available');
                continue;
            }
        } catch {
            continue;
        }

        // Test different text lengths
        for (const [key, label] of Object.entries({
            short: 'Short (10 chars)',
            medium: 'Medium (118 chars)',
            long: 'Long (734 chars)',
            very_long: 'Very Long (4600+ chars)'
        })) {
            const result = await testPerformance(model, key);

            if (result.success) {
                console.log(`  ${label}: ${result.duration}ms (${result.msPerChar.toFixed(2)}ms/char)`);

                // Analyze based on current thresholds
                if (model.includes('gemma')) {
                    if (result.duration < 100) {
                        console.log(`    → Would detect: GPU (< 100ms)`);
                    } else if (result.duration > 500) {
                        console.log(`    → Would detect: CPU (> 500ms)`);
                    } else {
                        console.log(`    → Would detect: Moderate (100-500ms)`);
                    }
                } else if (model.includes('qwen')) {
                    if (result.duration < 200) {
                        console.log(`    → Would detect: GPU (< 200ms)`);
                    } else if (result.duration > 1000) {
                        console.log(`    → Would detect: CPU (> 1000ms)`);
                    } else {
                        console.log(`    → Would detect: Moderate (200-1000ms)`);
                    }
                }
            } else {
                console.log(`  ${label}: FAILED - ${result.error}`);
            }

            // Delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Calculate averages and patterns
        console.log('\n  📈 Analysis:');
        console.log('  If ms/char increases significantly with length → likely CPU');
        console.log('  If ms/char stays constant → likely GPU');
    }
}

async function testActualGPU() {
    console.log('\n\n🎯 GPU Reality Check');
    console.log('=' .repeat(60));
    console.log('Running nvidia-smi to check actual GPU usage...\n');

    const { exec } = require('child_process');

    return new Promise((resolve) => {
        exec('nvidia-smi', (error, stdout, stderr) => {
            if (error) {
                console.log('❌ nvidia-smi not available (no NVIDIA GPU or drivers)');
                resolve(false);
            } else {
                console.log('✅ NVIDIA GPU detected:');
                // Parse basic GPU info
                const lines = stdout.split('\n');
                lines.forEach(line => {
                    if (line.includes('NVIDIA') || line.includes('%') || line.includes('MiB')) {
                        console.log('  ' + line.trim());
                    }
                });
                resolve(true);
            }
        });
    });
}

async function testDockerGPU() {
    console.log('\n\n🐳 Docker GPU Check');
    console.log('=' .repeat(60));

    // Check if we're in a container
    const fs = require('fs');

    if (fs.existsSync('/.dockerenv')) {
        console.log('✅ Running inside Docker container');
    } else {
        console.log('❌ Not running in Docker');
    }

    // Check for nvidia runtime
    console.log('\n📋 Docker GPU requirements:');
    console.log('  1. nvidia-docker2 package installed');
    console.log('  2. Docker daemon configured with nvidia runtime');
    console.log('  3. Container started with --gpus all or --runtime=nvidia');
    console.log('  4. CUDA libraries available in container');
}

async function suggestFixes() {
    console.log('\n\n💡 Recommendations');
    console.log('=' .repeat(60));

    console.log('\n1. For Docker GPU support:');
    console.log('   docker run -d --gpus all --name ollama ollama/ollama');

    console.log('\n2. Check Ollama is using GPU:');
    console.log('   docker exec ollama nvidia-smi');
    console.log('   docker logs ollama | grep -i gpu');

    console.log('\n3. Force GPU/CPU mode instead of auto-detect:');
    console.log('   - Use "GPU Optimized" if you have GPU');
    console.log('   - Use "CPU Optimized" if CPU only');
    console.log('   - Auto-detect is unreliable for production');

    console.log('\n4. For long texts, increase timeout:');
    console.log('   - Use "Custom" performance mode');
    console.log('   - Set timeout to 60000ms or more');
}

async function main() {
    console.log('🔬 Ollama Embedding Performance Diagnostic');
    console.log('=' .repeat(60));
    console.log(`Ollama URL: ${OLLAMA_URL}\n`);

    // Check if Ollama is running
    try {
        await fetch(`${OLLAMA_URL}/api/tags`);
    } catch (error) {
        console.error('❌ Cannot connect to Ollama at', OLLAMA_URL);
        process.exit(1);
    }

    await checkOllamaInfo();
    await runPerformanceTests();
    await testActualGPU();
    await testDockerGPU();
    await suggestFixes();

    console.log('\n\n🏁 Diagnostic Complete!');
    console.log('\n⚠️  Auto-detection is unreliable because:');
    console.log('  - First request timing depends on text length');
    console.log('  - Model may be cached or not');
    console.log('  - Docker GPU passthrough is complex');
    console.log('  - No API to check actual GPU availability');
    console.log('\n✅ Recommendation: Use fixed "GPU" or "CPU" mode, not auto-detect');
}

main().catch(console.error);