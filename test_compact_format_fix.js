#!/usr/bin/env node

/**
 * Test the fixed compact format
 */

// Simulate what the node does
function testCompactFormat() {
    console.log('🧪 Testing Fixed Compact Format');
    console.log('=' .repeat(60));

    // Simulate multiple embeddings
    const embeddings = [
        [0.123, -0.456, 0.789, -0.012, 0.345],
        [0.987, -0.654, 0.321, -0.098, 0.765],
        [0.111, -0.222, 0.333, -0.444, 0.555]
    ];

    console.log('\n📦 Original embeddings array:');
    console.log('Type:', typeof embeddings);
    console.log('Length:', embeddings.length, 'embeddings');
    console.log('Each embedding has', embeddings[0].length, 'dimensions');

    // OLD METHOD (array of strings - bad)
    const oldMethod = embeddings.map((e) => `[${e.join(',')}]`);
    console.log('\n❌ OLD METHOD - Array of strings:');
    console.log('Type:', typeof oldMethod);
    console.log('Is Array?', Array.isArray(oldMethod));
    console.log('Output:');
    oldMethod.forEach((s, i) => console.log(`  [${i}]: ${s}`));
    console.log('Problem: n8n shows each string on a new line!');

    // NEW METHOD (single JSON string - good)
    const newMethod = JSON.stringify(embeddings).replace(/\s+/g, '');
    console.log('\n✅ NEW METHOD - Single JSON string:');
    console.log('Type:', typeof newMethod);
    console.log('Is Array?', Array.isArray(newMethod));
    console.log('Length:', newMethod.length, 'characters');
    console.log('Output (first 200 chars):');
    console.log(newMethod.substring(0, 200) + '...');
    console.log('Full output on ONE line!');

    // Verify it can be parsed back
    console.log('\n🔄 Can we parse it back?');
    try {
        const parsed = JSON.parse(newMethod);
        console.log('✅ Yes! Parsed successfully');
        console.log('Type after parsing:', typeof parsed);
        console.log('Is Array?', Array.isArray(parsed));
        console.log('Length:', parsed.length, 'embeddings');
    } catch (error) {
        console.log('❌ Parse failed:', error.message);
    }

    // Show what n8n would display
    console.log('\n📺 In n8n UI:');
    console.log('OLD: Shows 3 lines (one per embedding)');
    console.log('NEW: Shows 1 line (all embeddings in JSON)');

    // Test with realistic data
    console.log('\n\n🌍 Realistic Test (1024 dimensions, 3 embeddings):');
    const realistic = Array(3).fill(null).map(() =>
        Array(1024).fill(null).map(() => Math.random() * 2 - 1)
    );

    const compactRealistic = JSON.stringify(realistic).replace(/\s+/g, '');
    console.log('Compact string length:', compactRealistic.length, 'characters');
    console.log('Preview (first 100 chars):', compactRealistic.substring(0, 100) + '...');
    console.log('Single line?', !compactRealistic.includes('\n') ? '✅ YES' : '❌ NO');
}

testCompactFormat();