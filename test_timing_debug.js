#!/usr/bin/env node

/**
 * Debug script for timing and compact format issues
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Test timing for different models
async function testTiming(model, text) {
    console.log(`\n🔍 Testing ${model}:`);
    console.log('='.repeat(50));

    const timings = [];

    // Run 5 tests to get average
    for (let i = 1; i <= 5; i++) {
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
            timings.push(duration);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const dims = data.embeddings?.[0]?.length || 0;

            console.log(`  Test ${i}: ${duration}ms (${dims} dimensions)`);

            // Auto-detection logic simulation
            if (i === 1) {
                if (duration < 1000) {
                    console.log(`  → Would detect: GPU (< 1000ms)`);
                } else if (duration > 5000) {
                    console.log(`  → Would detect: CPU (> 5000ms)`);
                } else {
                    console.log(`  → Would keep default (1000-5000ms)`);
                }
            }

        } catch (error) {
            console.log(`  Test ${i}: ERROR - ${error.message}`);
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (timings.length > 0) {
        const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
        const min = Math.min(...timings);
        const max = Math.max(...timings);

        console.log(`\n  📊 Statistics:`);
        console.log(`     Average: ${avg}ms`);
        console.log(`     Min: ${min}ms`);
        console.log(`     Max: ${max}ms`);
    }
}

// Test compact format
function testCompactFormat() {
    console.log('\n\n📝 Testing Compact Format Logic:');
    console.log('='.repeat(50));

    const testEmbedding = [0.123, -0.456, 0.789, -0.012, 0.345];

    // Current implementation (problematic)
    const compactCurrent = JSON.stringify(testEmbedding);
    console.log('\n❌ Current Implementation (JSON.stringify):');
    console.log('Type:', typeof compactCurrent);
    console.log('Value:', compactCurrent);
    console.log('Issue: Returns a STRING, not an array!');

    // Better implementation options:
    console.log('\n✅ Better Options:');

    // Option 1: Keep as array but format for display
    console.log('\nOption 1 - Array with compact display:');
    console.log('Type:', typeof testEmbedding);
    console.log('Value:', testEmbedding);
    console.log('Display:', JSON.stringify(testEmbedding));

    // Option 2: Return as formatted string field
    console.log('\nOption 2 - Separate formatted field:');
    const result = {
        embedding: testEmbedding,
        embeddingCompact: JSON.stringify(testEmbedding)
    };
    console.log('Result:', result);
}

async function main() {
    console.log('🧪 Debug Script for Timing & Compact Format Issues');
    console.log('=' * 60);
    console.log(`Ollama URL: ${OLLAMA_URL}\n`);

    // Check Ollama is running
    try {
        await fetch(`${OLLAMA_URL}/api/tags`);
    } catch (error) {
        console.error('❌ Ollama is not running at', OLLAMA_URL);
        process.exit(1);
    }

    const testText = 'This is a test sentence for embedding timing analysis.';

    // Test different models
    const models = [
        'qwen3-embedding:0.6b',
        'embeddinggemma:300m',
        'nomic-embed-text'
    ];

    for (const model of models) {
        try {
            const checkResponse = await fetch(`${OLLAMA_URL}/api/tags`);
            const data = await checkResponse.json();
            const available = data.models?.some(m => m.name === model);

            if (available) {
                await testTiming(model, testText);
            } else {
                console.log(`\n⚠️  ${model} not available (run: ollama pull ${model})`);
            }
        } catch (error) {
            console.error(`\n❌ Error testing ${model}:`, error.message);
        }
    }

    // Test compact format logic
    testCompactFormat();

    console.log('\n\n📋 Conclusions:');
    console.log('1. If Gemma is always fast (<1000ms), auto-detection will always think it\'s GPU');
    console.log('2. Compact format returning a string instead of array breaks the output');
    console.log('3. Need to adjust auto-detection thresholds per model');
    console.log('4. Need to fix compact format to keep array type');
}

main().catch(console.error);