# Bugs Identifiés - n8n-nodes-qwen-embedding

## 🔴 P0 - BLOQUANTS (empêchent le nœud de fonctionner)

### Bug #1: Endpoint API incorrect (ligne 274)
**Fichier:** `nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts:274`

```typescript
// ❌ INCORRECT
url: `${apiUrl}/api/embeddings`,

// ✅ CORRECT
url: `${apiUrl}/api/embed`,
```

**Impact:** HTTP 405 Method Not Allowed
**Cause:** L'API Ollama utilise `/api/embed` (singulier), pas `/api/embeddings`
**Référence:** https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings

---

### Bug #2: Champ de requête incorrect (ligne 268)
**Fichier:** `nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts:268`

```typescript
// ❌ INCORRECT
const requestBody = {
    model: modelName,
    prompt: text,  // Ollama uses 'prompt' not 'input'
};

// ✅ CORRECT
const requestBody = {
    model: modelName,
    input: text,  // Ollama API expects 'input' field
};
```

**Impact:** Requête invalide, embeddings non générés
**Cause:** L'API Ollama `/api/embed` attend le champ `input`, pas `prompt`
**Note:** Le commentaire ligne 268 est FAUX et doit être corrigé

---

### Bug #3: Modèle par défaut incorrect (ligne 36)
**Fichier:** `nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts:36`

```typescript
// ❌ INCORRECT (format HuggingFace)
default: 'Qwen/Qwen3-Embedding-0.6B',
placeholder: 'e.g., Qwen/Qwen3-Embedding-0.6B, qwen2.5:0.5b, qwen2.5:1.5b',

// ✅ CORRECT (format Ollama)
default: 'qwen3-embedding:0.6b',
placeholder: 'e.g., qwen3-embedding:0.6b, qwen2:0.5b, qwen2:1.5b, nomic-embed-text',
```

**Impact:** Model not found error par défaut
**Cause:** Ollama n'accepte pas le format HuggingFace `Qwen/Qwen3-Embedding-0.6B`
**Note:** Le modèle existe comme `qwen3-embedding:0.6b` dans Ollama

---

## 🟡 P1 - IMPORTANT (commentaires trompeurs)

### Bug #4: Commentaire erroné (ligne 268)
**Fichier:** `nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts:268`

```typescript
// ❌ FAUX
prompt: text,  // Ollama uses 'prompt' not 'input'

// ✅ CORRECT
input: text,  // Ollama API expects 'input' field for embeddings
```

**Impact:** Confusion pour les développeurs
**Cause:** Le commentaire contredit la vraie API Ollama

---

## 🟢 P2 - AMÉLIORATIONS (fonctionnalités à optimiser)

### Bug #5: Dimension adjustment manuel (lignes 318-330)
**Fichier:** `nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts:318-330`

**Problème actuel:**
```typescript
// Approche manuelle avec padding/truncation
if (targetDim < currentDim) {
    embedding = embedding.slice(0, targetDim);
} else if (targetDim > currentDim) {
    const padding = new Array(targetDim - currentDim).fill(0);
    embedding = [...embedding, ...padding];
}
```

**Amélioration proposée:**
```typescript
// Utiliser le paramètre natif Ollama pour MRL
const requestBody = {
    model: modelName,
    input: text,
    options: {
        // Qwen3 supporte MRL nativement (32-1024 dimensions)
        ...(options.dimensions && { dimensions: options.dimensions }),
    },
};
```

**Bénéfices:**
- Utilise Matryoshka Representation Learning natif de Qwen3
- Pas de padding artificiel (qualité préservée)
- Performance GPU optimale

**Note:** Vérifier si Ollama supporte le paramètre `dimensions` dans l'API

---

### Bug #6: Timeout non configurable (ligne 278)
**Fichier:** `nodes/QwenEmbeddingTool/QwenEmbeddingTool.node.ts:278`

**Problème actuel:**
```typescript
timeout: 30000, // 30 second timeout (hardcodé)
```

**Amélioration proposée:**
```typescript
// Ajouter dans options (lignes 99-176)
{
    displayName: 'Request Timeout',
    name: 'timeout',
    type: 'number',
    default: 30000,
    description: 'Timeout in milliseconds (default: 30s, with GPU: 5-10s sufficient)',
    typeOptions: {
        minValue: 1000,
        maxValue: 120000,
    },
},

// Utiliser dans la requête
timeout: options.timeout || 30000,
```

**Bénéfices:**
- Timeout ajustable selon configuration (CPU vs GPU)
- Meilleure expérience utilisateur

---

## 📋 Résumé des priorités

| Priorité | Bugs | Impact | Urgence |
|----------|------|--------|---------|
| P0 - Bloquant | #1, #2, #3 | Nœud non fonctionnel | **IMMÉDIAT** |
| P1 - Important | #4 | Confusion développeurs | Bientôt |
| P2 - Amélioration | #5, #6 | Expérience utilisateur | Souhaitable |

---

## 🔧 Plan de fix

### Phase 1: Bugs bloquants (P0)
1. Fixer endpoint: `/api/embeddings` → `/api/embed`
2. Fixer champ requête: `prompt` → `input`
3. Fixer modèle défaut: `Qwen/...` → `qwen3-embedding:0.6b`
4. Supprimer commentaire trompeur

### Phase 2: Tests
1. Créer tests unitaires pour l'API Ollama
2. Tester avec GPU (vérifier performances)
3. Tester batch embeddings
4. Tester dimension adjustment

### Phase 3: Améliorations (P2)
1. Investiguer support natif `dimensions` dans Ollama
2. Rendre timeout configurable
3. Améliorer gestion d'erreurs

### Phase 4: Documentation
1. Mettre à jour README avec exemples corrects
2. Documenter configuration Ollama + GPU
3. Ajouter troubleshooting guide

---

## 🎯 Fichiers à modifier

| Fichier | Lignes | Changements |
|---------|--------|-------------|
| `QwenEmbeddingTool.node.ts` | 36 | Modèle par défaut |
| `QwenEmbeddingTool.node.ts` | 268 | Champ `input` |
| `QwenEmbeddingTool.node.ts` | 274 | Endpoint `/api/embed` |
| `QwenEmbeddingTool.node.ts` | 318-330 | Dimension MRL natif (P2) |
| `QwenEmbeddingTool.node.ts` | 278 | Timeout configurable (P2) |

---

## ✅ Checklist de validation

Avant de merger le fix:

- [ ] Bugs P0 corrigés (#1, #2, #3)
- [ ] Tests unitaires créés et passent
- [ ] Test manuel avec Ollama local réussi
- [ ] Test avec GPU vérifié (< 500ms par embedding)
- [ ] Documentation mise à jour
- [ ] Version bump: 0.3.2 → 0.3.4
- [ ] CHANGELOG.md créé avec les fixes
- [ ] PR créée avec description complète
