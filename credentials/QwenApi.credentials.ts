import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class QwenApi implements ICredentialType {
	name = 'qwenApi';
	displayName = 'Qwen Embedding API';
	documentationUrl = 'https://github.com/QwenLM/Qwen3-Embedding';

	properties: INodeProperties[] = [
		{
			displayName: 'API URL',
			name: 'apiUrl',
			type: 'string',
			default: 'http://localhost:8080',
			placeholder: 'http://localhost:8080',
			description: 'The base URL of your self-hosted Qwen3-Embedding server',
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
			description: 'Optional API key for authentication (leave empty if not required)',
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

	// Test the credentials by calling the health endpoint
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.apiUrl}}',
			url: '/health',
			method: 'GET',
			skipSslCertificateValidation: true,
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'healthy',
					message: 'Connected to Qwen3-Embedding server successfully!',
				},
			},
		],
	};
}