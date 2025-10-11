#!/usr/bin/env node

/**
 * Test script to verify compact format is truly single-line
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

async function testCompactFormat() {
    console.log('🧪 Testing Compact Format Output');
    console.log('=' .repeat(60));

    // Test with a real embedding
    const body = {
        model: 'qwen3-embedding:0.6b',
        input: 'Test text for compact format'
    };

    try {
        const response = await fetch(`${OLLAMA_URL}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const embedding = data.embeddings[0];

        console.log('\n📊 Original embedding:');
        console.log('Type:', typeof embedding);
        console.log('Length:', embedding.length);
        console.log('First 5 values:', embedding.slice(0, 5));

        // Test different compact format approaches
        console.log('\n\n🔬 Testing Different Compact Formats:');
        console.log('-'.repeat(60));

        // Method 1: JSON.stringify (what we had before)
        const method1 = JSON.stringify(embedding);
        console.log('\n1️⃣ JSON.stringify():');
        console.log('Length:', method1.length, 'characters');
        console.log('Preview (first 100 chars):', method1.substring(0, 100) + '...');
        console.log('Has newlines?', method1.includes('\n') ? 'YES ❌' : 'NO ✅');

        // Method 2: Array.join() with brackets (our new approach)
        const method2 = `[${embedding.join(',')}]`;
        console.log('\n2️⃣ Array.join() with brackets:');
        console.log('Length:', method2.length, 'characters');
        console.log('Preview (first 100 chars):', method2.substring(0, 100) + '...');
        console.log('Has newlines?', method2.includes('\n') ? 'YES ❌' : 'NO ✅');

        // Method 3: Array.join() with no spaces (most compact)
        const method3 = embedding.join(',');
        console.log('\n3️⃣ Array.join() without brackets:');
        console.log('Length:', method3.length, 'characters');
        console.log('Preview (first 100 chars):', method3.substring(0, 100) + '...');
        console.log('Has newlines?', method3.includes('\n') ? 'YES ❌' : 'NO ✅');

        // Test parsing back
        console.log('\n\n🔄 Test Parsing Back:');
        console.log('-'.repeat(60));

        try {
            const parsed1 = JSON.parse(method1);
            console.log('Method 1 (JSON.stringify): Parseable ✅');
        } catch {
            console.log('Method 1 (JSON.stringify): Not parseable ❌');
        }

        try {
            const parsed2 = JSON.parse(method2);
            console.log('Method 2 (join with brackets): Parseable ✅');
        } catch {
            console.log('Method 2 (join with brackets): Not parseable ❌');
        }

        try {
            const parsed3 = JSON.parse(`[${method3}]`);
            console.log('Method 3 (join, add brackets): Parseable ✅');
        } catch {
            console.log('Method 3 (join, add brackets): Not parseable ❌');
        }

        // Test how n8n might display it
        console.log('\n\n📺 How it appears in n8n:');
        console.log('-'.repeat(60));
        console.log('Single embedding compact format:');
        console.log(method2.substring(0, 200) + '...');

        // Test batch format
        const batch = [embedding.slice(0, 5), embedding.slice(5, 10)];
        const batchCompact = batch.map(e => `[${e.join(',')}]`);
        console.log('\nBatch embeddings compact format (array of strings):');
        batchCompact.forEach((emb, idx) => {
            console.log(`  [${idx}]: ${emb}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
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

    await testCompactFormat();

    console.log('\n\n✅ Summary:');
    console.log('- Method 2 (Array.join with brackets) is best');
    console.log('- Creates a true single-line string');
    console.log('- Still parseable as JSON');
    console.log('- No newlines or extra spaces');
}

main().catch(console.error);