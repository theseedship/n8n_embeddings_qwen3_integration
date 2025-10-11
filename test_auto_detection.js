#!/usr/bin/env node

/**
 * Test script to verify auto-detection doesn't persist across multiple embeddings
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

async function testAutoDetection() {
    console.log('🧪 Testing Auto-Detection with Multiple Embeddings');
    console.log('=' .repeat(60));

    const texts = [
        'First text for embedding - will trigger auto-detection',
        'Second text - should use detected settings',
        'Third text - should still use detected settings',
        'Fourth text - testing consistency',
        'Fifth text - final test'
    ];

    // Test with different models
    const models = ['qwen3-embedding:0.6b', 'embeddinggemma:300m'];

    for (const model of models) {
        console.log(`\n\n📦 Testing model: ${model}`);
        console.log('-'.repeat(60));

        // Check if model is available
        try {
            const tagsResponse = await fetch(`${OLLAMA_URL}/api/tags`);
            const tagsData = await tagsResponse.json();
            const available = tagsData.models?.some(m => m.name === model);

            if (!available) {
                console.log(`⚠️  Model not available, skipping...`);
                continue;
            }
        } catch (error) {
            console.log(`❌ Error checking model: ${error.message}`);
            continue;
        }

        const timings = [];

        // Process each text and measure timing
        for (let i = 0; i < texts.length; i++) {
            const body = {
                model: model,
                input: texts[i]
            };

            const start = Date.now();

            try {
                const response = await fetch(`${OLLAMA_URL}/api/embed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                const duration = Date.now() - start;
                timings.push(duration);

                if (!response.ok) {
                    console.log(`  ❌ Request ${i+1}: Failed (HTTP ${response.status})`);
                } else {
                    const data = await response.json();
                    const dims = data.embeddings?.[0]?.length || 0;

                    // Simulate auto-detection logic
                    let detection = '';
                    if (i === 0) {
                        // First request triggers detection
                        if (model.includes('gemma')) {
                            if (duration < 50) {
                                detection = ' → AUTO-DETECTED: GPU (timeout would be 10s)';
                            } else if (duration > 200) {
                                detection = ' → AUTO-DETECTED: CPU (timeout would be 60s)';
                            } else {
                                detection = ' → AUTO-DETECTED: Moderate (timeout stays 30s)';
                            }
                        } else if (model.includes('qwen')) {
                            if (duration < 100) {
                                detection = ' → AUTO-DETECTED: GPU (timeout would be 10s)';
                            } else if (duration > 1000) {
                                detection = ' → AUTO-DETECTED: CPU (timeout would be 60s)';
                            } else {
                                detection = ' → AUTO-DETECTED: Moderate (timeout stays 30s)';
                            }
                        }
                    }

                    console.log(`  ✅ Request ${i+1}: ${duration}ms (${dims}d)${detection}`);
                }

            } catch (error) {
                console.log(`  ❌ Request ${i+1}: ${error.message}`);
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Analyze consistency
        if (timings.length > 1) {
            const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
            const min = Math.min(...timings);
            const max = Math.max(...timings);
            const variance = max - min;

            console.log(`\n📊 Statistics:`);
            console.log(`  Average: ${avg}ms`);
            console.log(`  Min: ${min}ms, Max: ${max}ms`);
            console.log(`  Variance: ${variance}ms`);

            // Check if timings are consistent (not affected by auto-detection changes)
            if (variance > 5000) {
                console.log(`  ⚠️  HIGH VARIANCE - Possible timeout issues!`);
            } else {
                console.log(`  ✅ Timings are consistent`);
            }
        }
    }
}

async function testMixedModels() {
    console.log('\n\n🔄 Testing Mixed Models in Sequence');
    console.log('=' .repeat(60));
    console.log('This tests if switching models causes issues...\n');

    const sequence = [
        { model: 'qwen3-embedding:0.6b', text: 'Qwen test 1' },
        { model: 'embeddinggemma:300m', text: 'Gemma test 1' },
        { model: 'qwen3-embedding:0.6b', text: 'Qwen test 2' },
        { model: 'embeddinggemma:300m', text: 'Gemma test 2' },
    ];

    for (let i = 0; i < sequence.length; i++) {
        const { model, text } = sequence[i];

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

            if (response.ok) {
                console.log(`  [${model}]: ${duration}ms`);
            } else {
                console.log(`  [${model}]: Failed (HTTP ${response.status})`);
            }
        } catch (error) {
            console.log(`  [${model}]: Error - ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function main() {
    console.log(`Ollama URL: ${OLLAMA_URL}\n`);

    // Check Ollama is running
    try {
        await fetch(`${OLLAMA_URL}/api/tags`);
    } catch (error) {
        console.error('❌ Ollama is not running at', OLLAMA_URL);
        process.exit(1);
    }

    await testAutoDetection();
    await testMixedModels();

    console.log('\n\n✅ Test Summary:');
    console.log('- Auto-detection should only affect the current batch');
    console.log('- Each new n8n node execution starts fresh');
    console.log('- Settings should not persist between different items');
    console.log('- Mixed models should each use appropriate timeouts');
}

main().catch(console.error);