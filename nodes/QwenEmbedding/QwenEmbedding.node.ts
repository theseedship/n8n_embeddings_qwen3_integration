import type {
	INodeType,
	INodeTypeDescription,
	SupplyData,
	ISupplyDataFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';

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
		this.apiUrl = params.apiUrl;
		this.apiKey = params.apiKey;
		this.modelName = params.modelName || 'qwen3-embedding:0.6b';
		this.performanceMode = params.performanceMode || 'auto';
		this.maxRetries = params.maxRetries || 2;
		this.timeout = params.timeout || 30000;
	}

	private async callOllamaEmbedAPI(texts: string[]): Promise<number[][]> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const embeddings: number[][] = [];

		// Ollama doesn't support batch embeddings, so we need to call it for each text
		for (const text of texts) {
			const requestBody = {
				model: this.modelName,
				input: text, // Ollama API expects 'input' field for embeddings
			};

			let attemptCount = 0;
			let currentTimeout = this.timeout;
			let currentMaxRetries = this.maxRetries;

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
						if (duration < 1000) {
							// Fast response - likely GPU
							currentTimeout = 10000;
							currentMaxRetries = 2;
							this.timeout = currentTimeout;
							this.maxRetries = currentMaxRetries;
							console.log(`[Auto-detect] GPU detected (${duration}ms). Adjusted timeout to 10s.`);
						} else if (duration > 5000) {
							// Slow response - likely CPU
							currentTimeout = 60000;
							currentMaxRetries = 3;
							this.timeout = currentTimeout;
							this.maxRetries = currentMaxRetries;
							console.log(`[Auto-detect] CPU detected (${duration}ms). Adjusted timeout to 60s.`);
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
						console.log(
							`[Retry ${attemptCount}/${currentMaxRetries}] Request failed. Retrying in ${waitTime}ms...`,
						);
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
		displayName: 'Qwen Embedding',
		name: 'qwenEmbedding',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["instruction"] || "Generate embedding"}}',
		description: 'Generate text embeddings using Qwen3-Embedding model',
		defaults: {
			name: 'Qwen Embedding',
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
				placeholder: 'e.g., qwen3-embedding:0.6b, qwen2:0.5b, qwen2:1.5b, nomic-embed-text',
				description: 'The Qwen model to use for embeddings (must be pulled in Ollama)',
				required: true,
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
						default: 1024,
						description: 'Number of dimensions for the embedding vector (32-1024 via MRL)',
						typeOptions: {
							minValue: 32,
							maxValue: 1024,
							numberStepSize: 1,
						},
						hint: 'Qwen3 supports flexible dimensions from 32 to 1024 without retraining',
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
				dimensions: options.dimensions || 1024,
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
				`Failed to initialize Qwen embeddings: ${error.message}`,
			);
		}
	}
}
