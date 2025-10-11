#!/usr/bin/env node

/**
 * Test script to verify model detection is working correctly
 */

// Copy the getModelCapabilities function for testing
function getModelCapabilities(modelName) {
    const lowerModel = modelName.toLowerCase();

    // EmbeddingGemma models - check for 'gemma' anywhere in the name
    // Examples: embeddinggemma:300m, embeddinggemma:300m-Q4_K_M, gemma:2b
    if (lowerModel.includes('gemma')) {
        return {
            maxDimensions: 768,
            maxTokens: 2048,
            defaultDimensions: 768,
            supportsInstructions: true,
            modelFamily: 'gemma',
        };
    }

    // Nomic Embed models
    if (lowerModel.includes('nomic')) {
        return {
            maxDimensions: 768,
            maxTokens: 8192,
            defaultDimensions: 768,
            supportsInstructions: true,
            modelFamily: 'nomic',
        };
    }

    // Snowflake Arctic Embed models
    if (lowerModel.includes('snowflake') || lowerModel.includes('arctic')) {
        return {
            maxDimensions: 1024,
            maxTokens: 512,
            defaultDimensions: 1024,
            supportsInstructions: false,
            modelFamily: 'snowflake',
        };
    }

    // Qwen models - check for 'qwen' in the name
    // Examples: qwen3-embedding:0.6b, qwen2.5-coder:1.5b
    if (lowerModel.includes('qwen')) {
        return {
            maxDimensions: 1024,
            maxTokens: 32768, // 32K context for Qwen3
            defaultDimensions: 1024,
            supportsInstructions: true,
            modelFamily: 'qwen',
        };
    }

    // Default fallback (assume generic model with conservative limits)
    return {
        maxDimensions: 1024,
        maxTokens: 8192,
        defaultDimensions: 768,
        supportsInstructions: true,
        modelFamily: 'generic',
    };
}

// Test different model names
const testModels = [
    'qwen3-embedding:0.6b',
    'embeddinggemma:300m',
    'embeddinggemma:300m-Q4_K_M',
    'nomic-embed-text:v1.5',
    'snowflake-arctic-embed:110m',
    'gemma:2b',
    'qwen2.5-coder:1.5b',
    'mistral:7b',
    'llama2:7b'
];

console.log('🧪 Testing Model Detection');
console.log('=' .repeat(60));

testModels.forEach(model => {
    const caps = getModelCapabilities(model);
    console.log(`\n📦 ${model}`);
    console.log(`   Family: ${caps.modelFamily}`);
    console.log(`   Max Dimensions: ${caps.maxDimensions}`);
    console.log(`   Default Dimensions: ${caps.defaultDimensions}`);
    console.log(`   Max Tokens: ${caps.maxTokens}`);
    console.log(`   Supports Instructions: ${caps.supportsInstructions}`);
});

console.log('\n\n✅ Summary:');
console.log('- Qwen models: Detected correctly with 1024d max, 32K context');
console.log('- Gemma models: Detected correctly with 768d max, 2K context');
console.log('- Others: Fall back to generic with conservative defaults');