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
	maxRetries: number;
	timeout: number;

	constructor(params: QwenEmbeddingsParams) {
		super(params);
		this.apiUrl = params.apiUrl;
		this.apiKey = params.apiKey;
		this.modelName = params.modelName || 'Qwen/Qwen3-Embedding-0.6B';
		this.maxRetries = params.maxRetries || 3;
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
				input: text,
			};

			// Use a simple timeout promise wrapper for Node.js compatibility
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.timeout);

			try {
				const response = await fetch(`${this.apiUrl}/api/embed`, {
					method: 'POST',
					headers,
					body: JSON.stringify(requestBody),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);

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
			} catch (error) {
				clearTimeout(timeoutId);
				throw error;
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
				default: 'Qwen/Qwen3-Embedding-0.6B',
				placeholder: 'e.g., Qwen/Qwen3-Embedding-0.6B, qwen2.5:0.5b, qwen2.5:1.5b',
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
						default: 3,
						description: 'Maximum number of retries for API calls',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Timeout for API calls in milliseconds',
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
				maxRetries?: number;
				timeout?: number;
			};

			const embeddings = new QwenEmbeddings({
				apiUrl: credentials.baseUrl as string,
				apiKey: credentials.apiKey as string | undefined,
				modelName: modelName || 'Qwen/Qwen3-Embedding-0.6B',
				dimensions: options.dimensions || 1024,
				instruction: options.instruction !== 'none' ? options.instruction : undefined,
				prefix: options.prefix,
				maxRetries: options.maxRetries || 3,
				timeout: options.timeout || 30000,
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
