import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Model capabilities detection
interface ModelCapabilities {
	maxDimensions: number;
	maxTokens: number;
	defaultDimensions: number;
	supportsInstructions: boolean;
	modelFamily: string;
}

function getModelCapabilities(modelName: string): ModelCapabilities {
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

// Security helper functions
function validateUrl(url: string): string {
	try {
		const parsed = new URL(url);
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			// eslint-disable-next-line n8n-nodes-base/node-execute-block-wrong-error-thrown
			throw new Error('Only HTTP and HTTPS protocols are allowed');
		}
		return url;
	} catch (error) {
		// eslint-disable-next-line n8n-nodes-base/node-execute-block-wrong-error-thrown
		throw new Error(`Invalid API URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

function sanitizeText(text: string): string {
	// Remove control characters that could cause issues
	return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export class QwenEmbeddingTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ollama Embeddings Tool',
		name: 'qwenEmbeddingTool',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] || "Generate embeddings"}}',
		description:
			'Generate text embeddings using Ollama models (Qwen, EmbeddingGemma, Nomic, etc.) as a tool',
		defaults: {
			name: 'Ollama Embeddings Tool',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		icon: { light: 'file:qwen.svg', dark: 'file:qwen.svg' },
		credentials: [
			{
				name: 'ollamaApi',
				required: false, // Optional - not needed for self-hosted Ollama without auth
			},
		],
		properties: [
			{
				displayName: 'Model Name',
				name: 'modelName',
				type: 'string',
				default: 'qwen3-embedding:0.6b',
				placeholder: 'Enter exact model name as shown in "ollama list"',
				description:
					'The Ollama embedding model to use (must be pulled in Ollama first). Enter the EXACT name from "ollama list" command.',
				required: true,
				hint: 'Common models: qwen3-embedding:0.6b (1024d), embeddinggemma:300m (768d), nomic-embed-text (768d), snowflake-arctic-embed (1024d)',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'generateEmbedding',
				options: [
					{
						name: 'Generate Embedding',
						value: 'generateEmbedding',
						description: 'Generate embedding for a single text',
						action: 'Generate embedding for a single text',
					},
					{
						name: 'Generate Batch Embeddings',
						value: 'generateBatch',
						description: 'Generate embeddings for multiple texts',
						action: 'Generate embeddings for multiple texts',
					},
				],
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'Enter text to generate embedding...',
				description: 'The text to generate embeddings for',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						operation: ['generateEmbedding'],
					},
				},
			},
			{
				displayName: 'Texts',
				name: 'texts',
				type: 'string',
				default: '={{ $json.texts }}',
				required: true,
				placeholder: 'Enter texts as array or reference...',
				description: 'Array of texts to generate embeddings for',
				displayOptions: {
					show: {
						operation: ['generateBatch'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Compact Format',
						name: 'compactFormat',
						type: 'boolean',
						default: false,
						description: 'Whether to format embeddings in a single line (easier to copy/paste)',
						hint: 'When enabled, embeddings are output as a single line instead of multi-line JSON',
					},
					{
						displayName: 'Context Prefix',
						name: 'prefix',
						type: 'string',
						default: '',
						placeholder: 'e.g., "This document is about:"',
						description: 'Optional prefix to prepend to the text for better semantic understanding',
					},
					{
						displayName: 'Custom Timeout (Ms)',
						name: 'customTimeout',
						type: 'number',
						default: 30000,
						description: 'Request timeout in milliseconds',
						typeOptions: {
							minValue: 1000,
							maxValue: 300000,
							numberStepSize: 1000,
						},
						displayOptions: {
							show: {
								performanceMode: ['custom'],
							},
						},
						hint: 'GPU: 5-10s, CPU: 30-60s recommended',
					},
					{
						displayName: 'Dimensions',
						name: 'dimensions',
						type: 'number',
						default: 0,
						description:
							'Number of dimensions for the embedding vector (0 = auto-detect from model)',
						typeOptions: {
							minValue: 0,
							maxValue: 1024,
							numberStepSize: 1,
						},
						hint: 'Max dimensions vary by model: Qwen (32-1024), EmbeddingGemma (128-768), Nomic (768). Set to 0 for automatic detection.',
					},
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: false,
						description: 'Whether to include model metadata in the output',
					},
					{
						displayName: 'Instruction Type',
						name: 'instruction',
						type: 'options',
						default: 'none',
						description: 'Use instruction-aware encoding for better performance',
						options: [
							{
								name: 'None',
								value: 'none',
								description: 'No specific instruction',
							},
							{
								name: 'Query',
								value: 'query',
								description: 'For search queries (1-5% performance boost)',
							},
							{
								name: 'Document',
								value: 'document',
								description: 'For documents being indexed',
							},
						],
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						default: 2,
						description: 'Maximum number of retry attempts on failure',
						typeOptions: {
							minValue: 0,
							maxValue: 5,
							numberStepSize: 1,
						},
						displayOptions: {
							show: {
								performanceMode: ['custom'],
							},
						},
					},
					{
						displayName: 'Performance Mode',
						name: 'performanceMode',
						type: 'options',
						default: 'auto',
						description: 'Optimize timeouts and retries based on your Ollama hardware setup',
						options: [
							{
								name: 'Auto-Detect',
								value: 'auto',
								description: 'Automatically detect GPU/CPU on first request (recommended)',
							},
							{
								name: 'GPU Optimized',
								value: 'gpu',
								description: 'Fast inference with GPU: 10s timeout, 2 retries',
							},
							{
								name: 'CPU Optimized',
								value: 'cpu',
								description: 'Slower CPU inference: 60s timeout, 3 retries',
							},
							{
								name: 'Custom',
								value: 'custom',
								description: 'Manually specify timeout and retry settings',
							},
						],
					},
					{
						displayName: 'Return Format',
						name: 'returnFormat',
						type: 'options',
						default: 'full',
						description: 'Format of the returned embeddings',
						options: [
							{
								name: 'Full Response',
								value: 'full',
								description: 'Return complete response with metadata',
							},
							{
								name: 'Embedding Only',
								value: 'embedding',
								description: 'Return only the embedding vector',
							},
							{
								name: 'Simplified',
								value: 'simplified',
								description: 'Return simplified format for chaining',
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('ollamaApi');
		const apiUrl = validateUrl(credentials.baseUrl as string);
		const modelName =
			(this.getNodeParameter('modelName', 0) as string) || 'Qwen/Qwen3-Embedding-0.6B';

		const operation = this.getNodeParameter('operation', 0) as string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const options = this.getNodeParameter('options', itemIndex, {}) as {
					prefix?: string;
					dimensions?: number;
					instruction?: string;
					includeMetadata?: boolean;
					returnFormat?: string;
					performanceMode?: string;
					customTimeout?: number;
					maxRetries?: number;
					compactFormat?: boolean;
				};

				// Calculate timeout and retries based on performance mode
				const performanceMode = options.performanceMode || 'auto';
				let requestTimeout: number;
				let maxRetries: number;

				switch (performanceMode) {
					case 'gpu':
						requestTimeout = 10000; // 10 seconds for GPU
						maxRetries = 2;
						break;
					case 'cpu':
						requestTimeout = 60000; // 60 seconds for CPU
						maxRetries = 3;
						break;
					case 'custom':
						requestTimeout = options.customTimeout || 30000;
						maxRetries = options.maxRetries || 2;
						break;
					case 'auto':
					default:
						requestTimeout = 30000; // 30 seconds default
						maxRetries = 2;
						break;
				}

				let texts: string[] = [];

				if (operation === 'generateEmbedding') {
					// Single text embedding
					const textParam = this.getNodeParameter('text', itemIndex, '');
					const text = String(textParam); // Ensure it's converted to string
					if (!text || text.trim() === '') {
						throw new NodeOperationError(this.getNode(), 'Text input cannot be empty', {
							itemIndex,
						});
					}
					texts = [text.trim()];
				} else {
					// Batch embeddings
					const textsParam = this.getNodeParameter('texts', itemIndex) as string | string[];

					if (typeof textsParam === 'string') {
						// Try to parse as JSON if it's a string
						try {
							const parsed = JSON.parse(textsParam);
							texts = Array.isArray(parsed) ? parsed : [parsed];
						} catch {
							// If not JSON, treat as single text
							texts = [textsParam];
						}
					} else if (Array.isArray(textsParam)) {
						texts = textsParam;
					} else {
						texts = [String(textsParam)];
					}

					// Validate texts
					texts = texts
						.filter((t) => t && t.toString().trim() !== '')
						.map((t) => t.toString().trim());

					if (texts.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'No valid texts provided for batch embedding',
							{ itemIndex },
						);
					}
				}

				// Apply prefix if specified
				if (options.prefix) {
					texts = texts.map((text) => `${options.prefix} ${text}`);
				}

				// Apply instruction type if specified
				if (options.instruction && options.instruction !== 'none') {
					const instructionPrefix =
						options.instruction === 'query'
							? 'Instruct: Retrieve semantically similar text.\nQuery: '
							: 'Instruct: Represent this document for retrieval.\nDocument: ';
					texts = texts.map((text) => instructionPrefix + text);
				}

				// Ollama doesn't support batch embeddings, so we need to call it for each text
				const embeddings: number[][] = [];

				for (const text of texts) {
					// Prepare request body for Ollama
					const requestBody = {
						model: modelName,
						input: sanitizeText(text), // Sanitize input before sending to API
					};

					// Make HTTP request to Ollama embedding API using native fetch
					// NOTE: Using native fetch() because this.helpers.httpRequest transforms POST to GET
					let response: any;
					let attemptCount = 0;

					// Retry loop with auto-detection
					while (attemptCount <= maxRetries) {
						try {
							const requestStart = Date.now();

							// Use native fetch API to avoid N8N helper POST→GET transformation
							const fetchResponse = await fetch(`${apiUrl}/api/embed`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(requestBody),
								signal: AbortSignal.timeout(requestTimeout),
							});

							if (!fetchResponse.ok) {
								const error: any = new Error(
									`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`,
								);
								error.statusCode = fetchResponse.status;
								throw error;
							}

							response = await fetchResponse.json();

							// Auto-detection on first successful request
							if (performanceMode === 'auto' && embeddings.length === 0) {
								const duration = Date.now() - requestStart;
								const capabilities = getModelCapabilities(modelName);

								// Different models have different baseline speeds
								// EmbeddingGemma is extremely fast even on CPU (~90ms)
								// Qwen is moderately fast on GPU (~150ms)
								let gpuThreshold = 1000; // Default: <1s = GPU
								let cpuThreshold = 5000; // Default: >5s = CPU

								if (capabilities.modelFamily === 'gemma') {
									// Gemma is super fast, adjust thresholds
									gpuThreshold = 50; // <50ms = definitely GPU
									cpuThreshold = 200; // >200ms = likely CPU (though still fast)
								} else if (capabilities.modelFamily === 'qwen') {
									// Qwen has moderate speeds
									gpuThreshold = 100; // <100ms = GPU
									cpuThreshold = 1000; // >1s = CPU
								}

								if (duration < gpuThreshold) {
									// Fast response - likely GPU
									requestTimeout = 10000;
									maxRetries = 2;
									console.log(
										`[Auto-detect] GPU detected (${duration}ms < ${gpuThreshold}ms). Adjusted timeout to 10s.`,
									);
								} else if (duration > cpuThreshold) {
									// Slow response - likely CPU
									requestTimeout = 60000;
									maxRetries = 3;
									console.log(
										`[Auto-detect] CPU detected (${duration}ms > ${cpuThreshold}ms). Adjusted timeout to 60s.`,
									);
								} else {
									// Medium speed - keep defaults
									console.log(
										`[Auto-detect] Moderate speed (${duration}ms). Keeping default timeout.`,
									);
								}
							}

							break; // Success - exit retry loop
						} catch (error: any) {
							attemptCount++;

							// Handle specific error cases
							if (error.message?.includes('ECONNREFUSED')) {
								throw new NodeOperationError(
									this.getNode(),
									`Cannot connect to Ollama at ${apiUrl}. Please ensure Ollama is running.`,
									{ itemIndex },
								);
							}
							if (error.statusCode === 404) {
								throw new NodeOperationError(
									this.getNode(),
									`Model ${modelName} not found. Please pull it first with: ollama pull ${modelName}`,
									{ itemIndex },
								);
							}

							// Retry logic with exponential backoff
							if (attemptCount <= maxRetries) {
								const waitTime = Math.min(1000 * Math.pow(2, attemptCount - 1), 5000);
								// Retrying request with exponential backoff
								await new Promise((resolve) => setTimeout(resolve, waitTime));
							} else {
								// Max retries reached
								throw new NodeOperationError(
									this.getNode(),
									`Failed after ${maxRetries} retries: ${error.message}`,
									{ itemIndex },
								);
							}
						}
					}

					// Validate response and extract embedding
					// Ollama returns 'embeddings' (plural) as an array
					if (
						!response ||
						!response.embeddings ||
						!Array.isArray(response.embeddings) ||
						response.embeddings.length === 0
					) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid response from Ollama: missing embeddings array',
							{ itemIndex },
						);
					}

					// Get model capabilities and apply dimension adjustment
					const capabilities = getModelCapabilities(modelName);
					let embedding = response.embeddings[0];

					// Handle dimensions (0 = auto-detect from model)
					let targetDim = options.dimensions || 0;
					if (targetDim === 0) {
						// Use model default dimensions (no adjustment needed)
						targetDim = embedding.length;
					} else if (targetDim > capabilities.maxDimensions) {
						// Warn and cap dimensions to model's maximum
						console.warn(
							`Warning: Requested dimensions (${targetDim}) exceed model maximum (${capabilities.maxDimensions}). Using ${capabilities.maxDimensions}.`,
						);
						targetDim = capabilities.maxDimensions;
					}

					// Apply dimension adjustment if needed
					if (targetDim !== embedding.length) {
						if (targetDim < embedding.length) {
							// Truncate to desired dimensions
							embedding = embedding.slice(0, targetDim);
						} else if (targetDim > embedding.length) {
							// Pad with zeros if requested dimensions exceed embedding size
							const padding = new Array(targetDim - embedding.length).fill(0);
							embedding = [...embedding, ...padding];
						}
					}

					// Add the processed embedding
					embeddings.push(embedding);
				}

				// Format output based on options
				const returnFormat = options.returnFormat || 'full';
				const compactFormat = options.compactFormat || false;

				if (operation === 'generateEmbedding') {
					// Single embedding response
					let outputItem: any;

					if (returnFormat === 'embedding') {
						outputItem = {
							embedding: embeddings[0],
						};
						// Add compact format as separate field if requested
						if (compactFormat) {
							outputItem.embeddingCompact = JSON.stringify(embeddings[0]);
						}
					} else if (returnFormat === 'simplified') {
						outputItem = {
							text: texts[0],
							vector: embeddings[0],
							dimensions: embeddings[0].length,
						};
						// Add compact format as separate field if requested
						if (compactFormat) {
							outputItem.vectorCompact = JSON.stringify(embeddings[0]);
						}
					} else {
						// Full response
						outputItem = {
							embedding: embeddings[0],
							dimensions: embeddings[0].length,
							text: texts[0],
							model: modelName,
						};
						// Add compact format as separate field if requested
						if (compactFormat) {
							outputItem.embeddingCompact = JSON.stringify(embeddings[0]);
						}

						// Add optional metadata
						if (options.includeMetadata) {
							outputItem.metadata = {
								prefix: options.prefix || '',
								instruction: options.instruction || 'none',
								timestamp: new Date().toISOString(),
							};
						}
					}

					returnData.push({
						json: outputItem,
						pairedItem: { item: itemIndex },
					});
				} else {
					// Batch embeddings response
					let outputItem: any;

					if (returnFormat === 'embedding') {
						outputItem = {
							embeddings: embeddings,
						};
						// Add compact format as separate field if requested
						if (compactFormat) {
							outputItem.embeddingsCompact = embeddings.map((e) => JSON.stringify(e));
						}
					} else if (returnFormat === 'simplified') {
						outputItem = {
							count: texts.length,
							vectors: embeddings,
							dimensions: embeddings[0] ? embeddings[0].length : 0,
						};
						// Add compact format as separate field if requested
						if (compactFormat) {
							outputItem.vectorsCompact = embeddings.map((e) => JSON.stringify(e));
						}
					} else {
						// Full response
						outputItem = {
							embeddings: embeddings,
							texts: texts,
							count: texts.length,
							dimensions: embeddings[0] ? embeddings[0].length : 0,
							model: modelName,
						};
						// Add compact format as separate field if requested
						if (compactFormat) {
							outputItem.embeddingsCompact = embeddings.map((e) => JSON.stringify(e));
						}

						// Add optional metadata
						if (options.includeMetadata) {
							outputItem.metadata = {
								prefix: options.prefix || '',
								instruction: options.instruction || 'none',
								timestamp: new Date().toISOString(),
								batchSize: texts.length,
							};
						}
					}

					// Also add individual items if needed for further processing
					if (returnFormat === 'full' && texts.length === embeddings.length) {
						outputItem.items = texts.map((text, idx) => {
							const item: any = {
								text: text,
								embedding: embeddings[idx],
							};
							if (compactFormat) {
								item.embeddingCompact = JSON.stringify(embeddings[idx]);
							}
							return item;
						});
					}

					returnData.push({
						json: outputItem,
						pairedItem: { item: itemIndex },
					});
				}
			} catch (error) {
				// Handle errors based on continueOnFail setting
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
							itemIndex,
						},
						pairedItem: { item: itemIndex },
						error,
					});
				} else {
					// Re-throw the error to stop execution
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
