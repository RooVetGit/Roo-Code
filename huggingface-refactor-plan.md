# HuggingFace Provider Refactoring Plan

## Overview

The HuggingFace provider implementation needs to be refactored to match the established pattern used by other providers that fetch models via network calls (e.g., OpenRouter, Glama, Ollama, etc.).

## Current Implementation Issues

1. **File locations are incorrect:**

    - `src/services/huggingface-models.ts` - Should be in `src/api/providers/fetchers/`
    - `src/api/huggingface-models.ts` - Unnecessary wrapper, should be removed

2. **Pattern mismatch:**
    - Current implementation returns raw HuggingFace model data
    - Should return `ModelInfo` records like other providers
    - Not integrated with the `modelCache.ts` system
    - Provider doesn't use `RouterProvider` base class or `fetchModel` pattern

## Established Pattern (from other providers)

### 1. Fetcher Pattern (`src/api/providers/fetchers/`)

- Fetcher files export a function like `getHuggingFaceModels()` that returns `Record<string, ModelInfo>`
- Fetchers handle API calls and transform raw data to `ModelInfo` format
- Example: `getOpenRouterModels()`, `getGlamaModels()`, `getOllamaModels()`

### 2. Provider Pattern (`src/api/providers/`)

- Providers either:
    - Extend `RouterProvider` and use `fetchModel()` (e.g., Glama)
    - Implement their own `fetchModel()` pattern (e.g., OpenRouter)
- Use `getModels()` from `modelCache.ts` to fetch and cache models

### 3. Model Cache Integration

- `RouterName` type includes all providers that use the cache
- `modelCache.ts` has a switch statement that calls the appropriate fetcher
- Provides memory and file caching for model lists

## Implementation Steps

### Step 1: Create new fetcher

- Move `src/services/huggingface-models.ts` to `src/api/providers/fetchers/huggingface.ts`
- Transform the fetcher to return `Record<string, ModelInfo>` instead of raw HuggingFace models
- Parse HuggingFace model data to extract:
    - `maxTokens`
    - `contextWindow`
    - `supportsImages` (based on pipeline_tag)
    - `description`
    - Other relevant `ModelInfo` fields

### Step 2: Update RouterName and modelCache

- Add `"huggingface"` to the `RouterName` type in `src/shared/api.ts`
- Add HuggingFace case to the switch statement in `modelCache.ts`
- Update `GetModelsOptions` type to include HuggingFace

### Step 3: Update HuggingFace provider

- Either extend `RouterProvider` or implement `fetchModel()` pattern
- Use `getModels()` from modelCache to fetch models
- Remove hardcoded model info from `getModel()`

### Step 4: Update webview integration

- Modify `webviewMessageHandler.ts` to use the new pattern
- Instead of importing from `src/api/huggingface-models.ts`, use `getModels()` with provider "huggingface"
- Transform the response to match the expected format for the webview

### Step 5: Cleanup

- Remove `src/api/huggingface-models.ts`
- Remove the old `src/services/huggingface-models.ts`
- Update any other imports

## Benefits of this refactoring

1. **Consistency**: HuggingFace will follow the same pattern as other providers
2. **Caching**: Model lists will be cached in memory and on disk
3. **Maintainability**: Easier to understand and modify when all providers follow the same pattern
4. **Type safety**: Better integration with TypeScript types
