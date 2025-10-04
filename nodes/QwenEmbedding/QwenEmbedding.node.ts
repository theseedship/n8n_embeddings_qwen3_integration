import type {
	INodeType,
	INodeTypeDescription,
	SupplyData,
	ISupplyDataFunctions,
} from 'n8n-workflow';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';

// LangChain-compatible Qwen Embeddings class
class QwenEmbeddings extends Embeddings {
	apiUrl: string;
	apiKey?: string;
	dimensions: number;
	instruction?: string;
	prefix?: string;
	maxRetries: number;
	timeout: number;

	constructor(params: QwenEmbeddingsParams) {
		super(params);
		this.apiUrl = params.apiUrl;
		this.apiKey = params.apiKey;
		this.dimensions = params.dimensions || 1024;
		this.instruction = params.instruction;
		this.prefix = params.prefix;
		this.maxRetries = params.maxRetries || 3;
		this.timeout = params.timeout || 30000;
	}

	private async callEmbedAPI(texts: string[]): Promise<number[][]> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const requestBody: any = {
			texts: texts.map(text => {
				if (this.prefix) {
					return `${this.prefix} ${text}`;
				}
				return text;
			}),
		};

		if (this.dimensions !== 1024) {
			requestBody.dimensions = this.dimensions;
		}

		if (this.instruction) {
			requestBody.instruction = this.instruction;
		}

		// Use a simple timeout promise wrapper for Node.js compatibility
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.apiUrl}/embed`, {
				method: 'POST',
				headers,
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Qwen Embedding API error (${response.status}): ${error}`);
			}

			const data = await response.json() as { embeddings?: number[][] };

			if (!data.embeddings || !Array.isArray(data.embeddings)) {
				throw new Error('Invalid response from Qwen server: missing embeddings array');
			}

			return data.embeddings;
		} catch (error) {
			clearTimeout(timeoutId);
			throw error;
		}
	}

	async embedDocuments(documents: string[]): Promise<number[][]> {
		// Qwen server supports batch embedding
		const batches: string[][] = [];
		const batchSize = 32; // Adjust based on server capacity

		for (let i = 0; i < documents.length; i += batchSize) {
			batches.push(documents.slice(i, i + batchSize));
		}

		const embeddings: number[][] = [];

		for (const batch of batches) {
			const batchEmbeddings = await this.callEmbedAPI(batch);
			embeddings.push(...batchEmbeddings);
		}

		return embeddings;
	}

	async embedQuery(document: string): Promise<number[]> {
		const embeddings = await this.callEmbedAPI([document]);
		return embeddings[0];
	}
}

interface QwenEmbeddingsParams extends EmbeddingsParams {
	apiUrl: string;
	apiKey?: string;
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
				name: 'qwenApi',
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
		const credentials = await this.getCredentials('qwenApi');

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			prefix?: string;
			dimensions?: number;
			instruction?: string;
			maxRetries?: number;
			timeout?: number;
		};

		const embeddings = new QwenEmbeddings({
			apiUrl: credentials.apiUrl as string,
			apiKey: credentials.apiKey as string | undefined,
			dimensions: options.dimensions || 1024,
			instruction: options.instruction !== 'none' ? options.instruction : undefined,
			prefix: options.prefix,
			maxRetries: options.maxRetries || 3,
			timeout: options.timeout || 30000,
		});

		return {
			response: embeddings,
		};
	}
}