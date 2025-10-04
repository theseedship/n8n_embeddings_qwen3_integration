import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class QwenApi implements ICredentialType {
	name = 'qwenApi';
	displayName = 'Qwen Embedding API (Ollama)';
	documentationUrl = 'https://ollama.com/library/qwen2.5';

	properties: INodeProperties[] = [
		{
			displayName: 'Ollama URL',
			name: 'apiUrl',
			type: 'string',
			default: 'http://localhost:11434',
			placeholder: 'http://localhost:11434',
			description: 'The base URL of your Ollama instance',
			required: true,
		},
		{
			displayName: 'Model Name',
			name: 'modelName',
			type: 'string',
			default: 'qwen2.5:0.5b',
			placeholder: 'e.g., Qwen/Qwen3-Embedding-0.6B, qwen2.5:0.5b, qwen2.5:1.5b',
			description: 'The Qwen model to use for embeddings (must be pulled in Ollama)',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Optional API key if your Ollama instance requires authentication',
			required: false,
		},
	];

	// Authentication configuration
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Authorization': '={{ $credentials.apiKey ? "Bearer " + $credentials.apiKey : undefined }}',
			},
		},
	};

	// Test the credentials by listing models
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.apiUrl}}',
			url: '/api/tags',
			method: 'GET',
			skipSslCertificateValidation: true,
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'models',
					value: undefined,
					message: 'Connected to Ollama successfully! Make sure your Qwen model is pulled.',
				},
			},
		],
	};
}