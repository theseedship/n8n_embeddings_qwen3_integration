import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class QwenEmbeddingTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Qwen Embedding Tool',
		name: 'qwenEmbeddingTool',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] || "Generate embeddings"}}',
		description: 'Generate text embeddings using Qwen3-Embedding model as a tool',
		defaults: {
			name: 'Qwen Embedding Tool',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		icon: { light: 'file:qwen.svg', dark: 'file:qwen.svg' },
		credentials: [
			{
				name: 'ollamaApi',
				required: true,
			},
		],
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
		const apiUrl = credentials.baseUrl as string;
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
				};

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
						prompt: text,  // Ollama uses 'prompt' not 'input'
					};

					// Make HTTP request to Ollama embedding API
					const requestOptions: IHttpRequestOptions = {
						method: 'POST',
						url: `${apiUrl}/api/embeddings`,
						body: requestBody,
						json: true,
						returnFullResponse: false,
						timeout: 30000, // 30 second timeout
					};

					let response: any;
					try {
						response = await this.helpers.httpRequestWithAuthentication.call(
							this,
							'ollamaApi',
							requestOptions,
						);
					} catch (error: any) {
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
						throw error;
					}

					// Validate response and extract embedding
					if (!response || !response.embedding) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid response from Ollama: missing embedding',
							{ itemIndex },
						);
					}

					// Ollama returns embedding directly
					embeddings.push(response.embedding);
				}

				// Format output based on options
				const returnFormat = options.returnFormat || 'full';

				if (operation === 'generateEmbedding') {
					// Single embedding response
					let outputItem: any;

					if (returnFormat === 'embedding') {
						outputItem = {
							embedding: embeddings[0],
						};
					} else if (returnFormat === 'simplified') {
						outputItem = {
							text: texts[0],
							vector: embeddings[0],
							dimensions: embeddings[0].length,
						};
					} else {
						// Full response
						outputItem = {
							embedding: embeddings[0],
							dimensions: embeddings[0].length,
							text: texts[0],
							model: modelName,
						};

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
					} else if (returnFormat === 'simplified') {
						outputItem = {
							count: texts.length,
							vectors: embeddings,
							dimensions: embeddings[0] ? embeddings[0].length : 0,
						};
					} else {
						// Full response
						outputItem = {
							embeddings: embeddings,
							texts: texts,
							count: texts.length,
							dimensions: embeddings[0] ? embeddings[0].length : 0,
							model: modelName,
						};

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
						outputItem.items = texts.map((text, idx) => ({
							text: text,
							embedding: embeddings[idx],
						}));
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
