## Summary

This PR refactors the HuggingFace provider implementation to match the established pattern used by other providers that fetch models via network calls (e.g., OpenRouter, Glama, Ollama).

## Changes

- **Moved fetcher to correct location**: Moved `huggingface-models.ts` from `src/services/` to `src/api/providers/fetchers/huggingface.ts`
- **Updated fetcher to return ModelInfo**: The fetcher now returns `Record<string, ModelInfo>` instead of raw HuggingFace model data, consistent with other providers
- **Integrated with model cache**: Added HuggingFace to `RouterName` type and integrated it with the `modelCache.ts` system for memory and file caching
- **Updated provider to extend RouterProvider**: The HuggingFace provider now extends the `RouterProvider` base class and uses the `fetchModel()` pattern
- **Removed unnecessary wrapper**: Deleted `src/api/huggingface-models.ts` as it's no longer needed
- **Updated webview integration**: Modified `webviewMessageHandler.ts` to use the new pattern with `getModels()` while maintaining backward compatibility

## Benefits

1. **Consistency**: HuggingFace now follows the same pattern as other providers
2. **Caching**: Model lists are now cached in memory and on disk
3. **Maintainability**: Easier to understand and modify when all providers follow the same pattern
4. **Type safety**: Better integration with TypeScript types

## Testing

- ✅ All existing tests pass
- ✅ TypeScript compilation successful
- ✅ Linting checks pass
- ✅ Added HuggingFace to RouterModels mock in webview tests
