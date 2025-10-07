# Makefile for n8n Qwen Embedding Development Environment

.PHONY: help build up down restart logs init-model clean rebuild dev

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

build: ## Build the n8n custom nodes
	@echo "Building n8n custom nodes..."
	npm run build

setup-dirs: ## Create necessary data directories
	@echo "Creating data directories..."
	mkdir -p data/ollama data/n8n
	chmod 755 init-ollama.sh

up: setup-dirs build ## Start all services
	@echo "Starting Docker services..."
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 10
	@echo "Services started! Access n8n at http://localhost:5678"

down: ## Stop all services
	@echo "Stopping Docker services..."
	docker-compose down

restart: down up ## Restart all services

logs: ## Show logs from all services
	docker-compose logs -f

logs-ollama: ## Show logs from Ollama service
	docker-compose logs -f ollama

logs-n8n: ## Show logs from n8n service
	docker-compose logs -f n8n

init-model: ## Initialize Ollama with Qwen embedding model
	@echo "Initializing Ollama with Qwen model..."
	@chmod +x init-ollama.sh
	@./init-ollama.sh

clean: ## Clean up all data and stop services
	@echo "Cleaning up..."
	docker-compose down -v
	rm -rf data/

rebuild: clean ## Rebuild everything from scratch
	@echo "Rebuilding from scratch..."
	docker-compose build --no-cache
	$(MAKE) up
	@sleep 15
	$(MAKE) init-model

dev: ## Start services and watch for changes
	@echo "Starting development mode..."
	$(MAKE) up
	@sleep 10
	$(MAKE) init-model
	@echo "Development environment ready!"
	@echo "n8n: http://localhost:5678"
	@echo "Ollama API: http://localhost:11434"
	@echo ""
	@echo "Watching for changes in nodes/ directory..."
	npm run dev

test-ollama: ## Test Ollama API connection
	@echo "Testing Ollama API..."
	@curl -s http://localhost:11434/api/tags | jq '.' || echo "Ollama is not running"

test-embedding: ## Test embedding generation with Ollama
	@echo "Testing embedding generation..."
	@curl -X POST http://localhost:11434/api/embeddings \
		-H "Content-Type: application/json" \
		-d '{"model": "qwen2.5:0.5b", "prompt": "Hello world"}' | jq '.'

status: ## Check status of all services
	@echo "Service Status:"
	@echo "==============="
	@docker-compose ps
	@echo ""
	@echo "Ollama Models:"
	@curl -s http://localhost:11434/api/tags 2>/dev/null | jq '.models[].name' 2>/dev/null || echo "Ollama not accessible"