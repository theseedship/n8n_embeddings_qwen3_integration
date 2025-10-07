// Nouveaux paramètres à ajouter dans options[] (ligne 99-176)

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
	displayName: 'Custom Timeout (ms)',
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
