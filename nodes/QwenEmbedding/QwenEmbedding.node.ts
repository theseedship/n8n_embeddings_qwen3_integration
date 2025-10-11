import type {
	INodeType,
	INodeTypeDescription,
	SupplyData,
	ISupplyDataFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';

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

// LangChain-compatible Ollama Qwen Embeddings class
class QwenEmbeddings extends Embeddings {
	apiUrl: string;
	apiKey?: string;
	modelName: string;
	performanceMode: string;
	maxRetries: number;
	timeout: number;

	constructor(params: QwenEmbeddingsParams) {
		super(params);
		this.apiUrl = this.validateUrl(params.apiUrl);
		this.apiKey = params.apiKey;
		this.modelName = params.modelName || 'qwen3-embedding:0.6b';
		this.performanceMode = params.performanceMode || 'auto';
		this.maxRetries = params.maxRetries || 2;
		this.timeout = params.timeout || 30000;
	}

	private validateUrl(url: string): string {
		try {
			const parsed = new URL(url);
			if (!['http:', 'https:'].includes(parsed.protocol)) {
				// eslint-disable-next-line n8n-nodes-base/node-execute-block-wrong-error-thrown
				throw new Error('Only HTTP and HTTPS protocols are allowed');
			}
			return url;
		} catch (error) {
			// eslint-disable-next-line n8n-nodes-base/node-execute-block-wrong-error-thrown
			throw new Error(
				`Invalid API URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}

	private sanitizeText(text: string): string {
		// Remove control characters that could cause issues
		return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
	}

	private async callOllamaEmbedAPI(texts: string[]): Promise<number[][]> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const embeddings: number[][] = [];

		// Store auto-detected settings for subsequent requests (don't modify class properties)
		let autoDetectedTimeout: number | undefined;
		let autoDetectedRetries: number | undefined;

		// Ollama doesn't support batch embeddings, so we need to call it for each text
		for (const text of texts) {
			const requestBody = {
				model: this.modelName,
				input: this.sanitizeText(text), // Sanitize input before sending to API
			};

			let attemptCount = 0;
			// Use auto-detected values if available, otherwise use original class values
			let currentTimeout = autoDetectedTimeout || this.timeout;
			let currentMaxRetries = autoDetectedRetries || this.maxRetries;

			// Retry loop with auto-detection
			while (attemptCount <= currentMaxRetries) {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), currentTimeout);

				try {
					const requestStart = Date.now();
					const response = await fetch(`${this.apiUrl}/api/embed`, {
						method: 'POST',
						headers,
						body: JSON.stringify(requestBody),
						signal: controller.signal,
					});
					clearTimeout(timeoutId);

					// Auto-detection on first successful request
					if (this.performanceMode === 'auto' && embeddings.length === 0) {
						const duration = Date.now() - requestStart;
						const capabilities = getModelCapabilities(this.modelName);

						// Different models have different baseline speeds
						let gpuThreshold = 1000; // Default: <1s = GPU
						let cpuThreshold = 5000; // Default: >5s = CPU

						if (capabilities.modelFamily === 'gemma') {
							// Gemma is very fast even on CPU, adjust thresholds
							gpuThreshold = 100; // <100ms = likely GPU
							cpuThreshold = 500; // >500ms = likely CPU
						} else if (capabilities.modelFamily === 'qwen') {
							// Qwen has moderate speeds
							gpuThreshold = 200; // <200ms = GPU
							cpuThreshold = 1000; // >1s = CPU
						}

						if (duration < gpuThreshold) {
							// Fast response - likely GPU
							autoDetectedTimeout = 10000;
							autoDetectedRetries = 2;
							console.log(
								`[Auto-detect] GPU detected (${duration}ms < ${gpuThreshold}ms). Adjusted timeout to 10s.`,
							);
						} else if (duration > cpuThreshold) {
							// Slow response - likely CPU
							autoDetectedTimeout = 60000;
							autoDetectedRetries = 3;
							console.log(
								`[Auto-detect] CPU detected (${duration}ms > ${cpuThreshold}ms). Adjusted timeout to 60s.`,
							);
						} else {
							// Medium speed - keep defaults
							autoDetectedTimeout = this.timeout;
							autoDetectedRetries = this.maxRetries;
							console.log(`[Auto-detect] Moderate speed (${duration}ms). Keeping default timeout.`);
						}
					}

					if (!response.ok) {
						const error = await response.text();
						const err = new Error(`Ollama API error (${response.status}): ${error}`);
						(err as any).statusCode = response.status;
						throw err;
					}

					const data = (await response.json()) as { embeddings?: number[][]; embedding?: number[] };

					// Ollama returns a single embedding array
					if (data.embeddings && Array.isArray(data.embeddings)) {
						embeddings.push(data.embeddings[0]);
					} else if (data.embedding && Array.isArray(data.embedding)) {
						embeddings.push(data.embedding);
					} else {
						const err = new Error('Invalid response from Ollama: missing embedding data');
						(err as any).statusCode = 500;
						throw err;
					}

					break; // Success - exit retry loop
				} catch (error: any) {
					clearTimeout(timeoutId);
					attemptCount++;

					// Retry logic with exponential backoff
					if (attemptCount <= currentMaxRetries) {
						const waitTime = Math.min(1000 * Math.pow(2, attemptCount - 1), 5000);
						// Retrying request with exponential backoff
						await new Promise((resolve) => setTimeout(resolve, waitTime));
					} else {
						// Max retries reached - rethrow original error
						throw error;
					}
				}
			}
		}

		return embeddings;
	}

	async embedDocuments(documents: string[]): Promise<number[][]> {
		return this.callOllamaEmbedAPI(documents);
	}

	async embedQuery(document: string): Promise<number[]> {
		const embeddings = await this.callOllamaEmbedAPI([document]);
		return embeddings[0];
	}
}

interface QwenEmbeddingsParams extends EmbeddingsParams {
	apiUrl: string;
	apiKey?: string;
	modelName?: string;
	dimensions?: number;
	instruction?: string;
	prefix?: string;
	performanceMode?: string;
	customTimeout?: number;
	maxRetries?: number;
	timeout?: number;
}

export class QwenEmbedding implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ollama Embeddings',
		name: 'qwenEmbedding',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["instruction"] || "Generate embedding"}}',
		description: 'Generate text embeddings using Ollama models (Qwen, EmbeddingGemma, Nomic, etc.)',
		defaults: {
			name: 'Ollama Embeddings',
		},
		inputs: [],
		outputs: ['ai_embedding'],
		outputNames: ['Embedding'],
		credentials: [
			{
				name: 'ollamaApi',
				required: true,
			},
		],
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://github.com/QwenLM/Qwen3-Embedding',
					},
				],
			},
		},
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
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
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
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		try {
			const credentials = await this.getCredentials('ollamaApi');
			const modelName = this.getNodeParameter('modelName', itemIndex) as string;

			const options = this.getNodeParameter('options', itemIndex, {}) as {
				prefix?: string;
				dimensions?: number;
				instruction?: string;
				performanceMode?: string;
				customTimeout?: number;
				maxRetries?: number;
			};

			// Get model capabilities
			const capabilities = getModelCapabilities(modelName);

			// Handle dimensions (0 = auto-detect from model)
			let dimensions = options.dimensions || 0;
			if (dimensions === 0) {
				dimensions = capabilities.defaultDimensions;
			} else if (dimensions > capabilities.maxDimensions) {
				// Warn and cap dimensions to model's maximum
				console.warn(
					`Warning: Requested dimensions (${dimensions}) exceed model maximum (${capabilities.maxDimensions}). Using ${capabilities.maxDimensions}.`,
				);
				dimensions = capabilities.maxDimensions;
			}

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

			const embeddings = new QwenEmbeddings({
				apiUrl: credentials.baseUrl as string,
				apiKey: credentials.apiKey as string | undefined,
				modelName: modelName || 'qwen3-embedding:0.6b',
				dimensions: dimensions,
				instruction: options.instruction !== 'none' ? options.instruction : undefined,
				prefix: options.prefix,
				performanceMode: performanceMode,
				customTimeout: options.customTimeout,
				maxRetries: maxRetries,
				timeout: requestTimeout,
			});

			return {
				response: embeddings,
			};
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Failed to initialize embeddings: ${error.message}`,
			);
		}
	}
}
