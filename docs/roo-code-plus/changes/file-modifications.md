# LiteLLM Integration: File Modifications

This document lists all files modified during the integration of the LiteLLM provider into Roo-Code-Plus.

## Backend (`src/`)

*   **`src/schemas/index.ts`**:
    *   Added `"litellm"` to `providerNames`.
    *   Added `litellmApiKey`, `litellmApiUrl`, `litellmModelId`, `litellmModelInfo` to `providerSettingsSchema`.
    *   Updated `providerSettingsRecord` and `PROVIDER_SETTINGS_KEYS`.

*   **`src/shared/api.ts`**:
    *   Added `liteLlmDefaultModelId` constant.
    *   Added `liteLlmModelInfoSaneDefaults` constant.

*   **`src/api/transform/litellm-format.ts`** (New File):
    *   Contains `convertToOpenAiMessages` function (copied/adapted from `openai-format.ts`).

*   **`src/api/providers/litellm.ts`** (New File):
    *   Implementation of the `LiteLLMHandler` class, extending `BaseProvider`.
    *   Includes logic for API interaction, streaming, and cost calculation via `/spend/calculate`.

*   **`src/api/index.ts`**:
    *   Imported `LiteLLMHandler`.
    *   Added `case "litellm"` to the `buildApiHandler` switch statement.

## Frontend (`webview-ui/`)

*   **`webview-ui/src/components/settings/constants.ts`**:
    *   Added `{ value: "litellm", label: "LiteLLM" }` to the `PROVIDERS` array.

*   **`webview-ui/src/components/settings/ApiOptions.tsx`**:
    *   Imported `liteLlmDefaultModelId`.
    *   Added a conditional rendering block (`{selectedProvider === "litellm" && ...}`) to display settings fields (API Key, API URL, Model ID) for the LiteLLM provider.

## Build/Dependencies

*   **`package.json`** (Root):
    *   (Initially added `zod-to-ts` to `devDependencies`, then removed).

*   **`webview-ui/package.json`**:
    *   (Initially added `@types/react` and `@types/react-i18next` to `devDependencies`, then removed).