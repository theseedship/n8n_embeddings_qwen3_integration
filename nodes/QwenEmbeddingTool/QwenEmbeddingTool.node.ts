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
				name: 'qwenApi',
				required: true,
			},
		],
		properties: [
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
					},
					{
						name: 'Generate Batch Embeddings',
						value: 'generateBatch',
						description: 'Generate embeddings for multiple texts',
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
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: false,
						description: 'Whether to include model metadata in the output',
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

		const credentials = await this.getCredentials('qwenApi');
		const apiUrl = credentials.apiUrl as string;

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
					const text = this.getNodeParameter('text', itemIndex, '') as string;
					if (!text || text.trim() === '') {
						throw new NodeOperationError(
							this.getNode(),
							'Text input cannot be empty',
							{ itemIndex }
						);
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
					texts = texts.filter(t => t && t.toString().trim() !== '').map(t => t.toString().trim());

					if (texts.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'No valid texts provided for batch embedding',
							{ itemIndex }
						);
					}
				}

				// Apply prefix if specified
				if (options.prefix) {
					texts = texts.map(text => `${options.prefix} ${text}`);
				}

				// Prepare request body
				const requestBody: any = {
					texts: texts,
				};

				if (options.dimensions && options.dimensions !== 1024) {
					// Validate dimension range
					if (options.dimensions < 32 || options.dimensions > 1024) {
						throw new NodeOperationError(
							this.getNode(),
							'Dimensions must be between 32 and 1024',
							{ itemIndex }
						);
					}
					requestBody.dimensions = options.dimensions;
				}

				if (options.instruction && options.instruction !== 'none') {
					requestBody.instruction = options.instruction;
				}

				// Make HTTP request to Qwen embedding server
				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: `${apiUrl}/embed`,
					body: requestBody,
					json: true,
					returnFullResponse: false,
					timeout: 30000, // 30 second timeout
				};

				let response: any;
				try {
					response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'qwenApi',
						requestOptions,
					);
				} catch (error: any) {
					// Handle specific error cases
					if (error.message?.includes('ECONNREFUSED')) {
						throw new NodeOperationError(
							this.getNode(),
							`Cannot connect to Qwen server at ${apiUrl}. Please ensure the server is running.`,
							{ itemIndex }
						);
					}
					if (error.statusCode === 500) {
						throw new NodeOperationError(
							this.getNode(),
							'Qwen server error. Check server logs for details.',
							{ itemIndex }
						);
					}
					throw error;
				}

				// Validate response
				if (!response || !response.embeddings || !Array.isArray(response.embeddings)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid response from Qwen server: missing embeddings array',
						{ itemIndex }
					);
				}

				// Format output based on options
				const returnFormat = options.returnFormat || 'full';

				if (operation === 'generateEmbedding') {
					// Single embedding response
					let outputItem: any;

					if (returnFormat === 'embedding') {
						outputItem = {
							embedding: response.embeddings[0],
						};
					} else if (returnFormat === 'simplified') {
						outputItem = {
							text: texts[0],
							vector: response.embeddings[0],
							dimensions: response.dimensions || response.embeddings[0].length,
						};
					} else {
						// Full response
						outputItem = {
							embedding: response.embeddings[0],
							dimensions: response.dimensions || response.embeddings[0].length,
							text: texts[0],
							model: response.model || 'Qwen3-Embedding-0.6B',
						};

						// Add optional metadata
						if (options.includeMetadata) {
							outputItem.metadata = {
								prefix: options.prefix || '',
								instruction: options.instruction || 'none',
								timestamp: new Date().toISOString(),
								processingTime: response.processing_time,
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
							embeddings: response.embeddings,
						};
					} else if (returnFormat === 'simplified') {
						outputItem = {
							count: texts.length,
							vectors: response.embeddings,
							dimensions: response.dimensions || (response.embeddings[0] ? response.embeddings[0].length : 0),
						};
					} else {
						// Full response
						outputItem = {
							embeddings: response.embeddings,
							texts: texts,
							count: texts.length,
							dimensions: response.dimensions || (response.embeddings[0] ? response.embeddings[0].length : 0),
							model: response.model || 'Qwen3-Embedding-0.6B',
						};

						// Add optional metadata
						if (options.includeMetadata) {
							outputItem.metadata = {
								prefix: options.prefix || '',
								instruction: options.instruction || 'none',
								timestamp: new Date().toISOString(),
								processingTime: response.processing_time,
								batchSize: texts.length,
							};
						}
					}

					// Also add individual items if needed for further processing
					if (returnFormat === 'full' && texts.length === response.embeddings.length) {
						outputItem.items = texts.map((text, idx) => ({
							text: text,
							embedding: response.embeddings[idx],
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