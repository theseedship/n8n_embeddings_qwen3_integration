#!/usr/bin/env node

/**
 * Test different output formats to see how n8n might display them
 */

function testFormats() {
    const embedding = [0.123, -0.456, 0.789, -0.012, 0.345];

    console.log('🧪 Testing Different Compact Formats\n');
    console.log('=' .repeat(60));

    // Format 1: Plain comma-separated (current)
    const format1 = embedding.join(',');
    console.log('\n1. Plain CSV (current approach):');
    console.log('   Value:', format1);
    console.log('   Type:', typeof format1);
    console.log('   Issue: n8n might parse as array');

    // Format 2: With quotes
    const format2 = `"${embedding.join(',')}"`;
    console.log('\n2. Quoted CSV:');
    console.log('   Value:', format2);
    console.log('   Type:', typeof format2);

    // Format 3: With brackets but as string
    const format3 = `[${embedding.join(',')}]`;
    console.log('\n3. String with brackets:');
    console.log('   Value:', format3);
    console.log('   Type:', typeof format3);

    // Format 4: Space-separated
    const format4 = embedding.join(' ');
    console.log('\n4. Space-separated:');
    console.log('   Value:', format4);
    console.log('   Type:', typeof format4);

    // Format 5: Semicolon-separated
    const format5 = embedding.join(';');
    console.log('\n5. Semicolon-separated:');
    console.log('   Value:', format5);
    console.log('   Type:', typeof format5);

    // Format 6: Pipe-separated
    const format6 = embedding.join('|');
    console.log('\n6. Pipe-separated:');
    console.log('   Value:', format6);
    console.log('   Type:', typeof format6);

    // Format 7: JSON but stringify twice
    const format7 = JSON.stringify(JSON.stringify(embedding));
    console.log('\n7. Double-stringified JSON:');
    console.log('   Value:', format7);
    console.log('   Type:', typeof format7);

    // Format 8: Base64
    const format8 = Buffer.from(JSON.stringify(embedding)).toString('base64');
    console.log('\n8. Base64:');
    console.log('   Value:', format8);
    console.log('   Type:', typeof format8);
    console.log('   Decode:', JSON.parse(Buffer.from(format8, 'base64').toString()));

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Recommendation:');
    console.log('   Try semicolon or pipe separator to avoid array detection');
    console.log('   Or use base64 if copy/paste is the goal');
}

testFormats();
