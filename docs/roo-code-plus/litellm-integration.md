# LiteLLM Provider Integration Details

This document details the technical implementation of the LiteLLM provider integration into Roo-Code-Plus.

## Overview

The LiteLLM provider allows Roo-Code-Plus to connect to any LLM supported by the [LiteLLM proxy](https://github.com/BerriAI/litellm). It leverages LiteLLM's OpenAI-compatible API endpoint for seamless integration.

## Backend Implementation (`src/api/`)

### 1. Schema (`src/schemas/index.ts`)

*   Added `"litellm"` to the `providerNames` enum.
*   Added the following optional fields to `providerSettingsSchema`:
    *   `litellmApiKey: z.string().optional()`: API key for the LiteLLM proxy (if required).
    *   `litellmApiUrl: z.string().optional()`: Base URL of the LiteLLM proxy (defaults to `http://localhost:4000`).
    *   `litellmModelId: z.string().optional()`: The specific model string to be passed to LiteLLM (e.g., `gpt-3.5-turbo`, `claude-2`, `ollama/llama2`).
    *   `litellmModelInfo: modelInfoSchema.nullish()`: Optional custom model info override.

### 2. Shared API Defaults (`src/shared/api.ts`)

*   Added `liteLlmDefaultModelId` (defaulting to `"gpt-3.5-turbo"`).
*   Added `liteLlmModelInfoSaneDefaults` providing generic placeholder values, as actual capabilities depend on the underlying model configured in LiteLLM.

### 3. Message Transformer (`src/api/transform/litellm-format.ts`)

*   Created by copying the existing `convertToOpenAiMessages` function from `openai-format.ts`. This works because LiteLLM exposes an OpenAI-compatible API.

### 4. Provider Handler (`src/api/providers/litellm.ts`)

*   Created `LiteLLMHandler` class extending `BaseProvider`.
*   **Constructor:** Initializes the `OpenAI` SDK client using the `litellmApiUrl` and `litellmApiKey` from the configuration. Defaults are provided if settings are missing.
*   **`createMessage`:**
    *   Uses `convertToOpenAiMessages` to format messages.
    *   Sends the request to the LiteLLM proxy via the initialized `OpenAI` client.
    *   Handles streaming responses.
    *   Calls `calculateCost` to determine the cost based on tokens and includes it in the final `usage` chunk.
*   **`calculateCost`:**
    *   A private helper method that sends a POST request to the `/spend/calculate` endpoint of the LiteLLM proxy.
    *   Requires the LiteLLM proxy to have cost tracking enabled.
    *   Calculates cost based on input and output tokens for the specified `litellmModelId`.
    *   Returns `undefined` if the endpoint fails or doesn't return a valid cost.
*   **`getModel`:** Returns the configured `litellmModelId` and `litellmModelInfo` (or defaults).
*   **`countTokens`:** Uses the default `tiktoken` implementation inherited from `BaseProvider`.

### 5. Provider Registration (`src/api/index.ts`)

*   Imported `LiteLLMHandler`.
*   Added a `case "litellm": return new LiteLLMHandler(options);` to the `switch` statement in `buildApiHandler`.

## Frontend Implementation (`webview-ui/`)

### 1. Provider List (`webview-ui/src/components/settings/constants.ts`)

*   Added `{ value: "litellm", label: "LiteLLM" }` to the `PROVIDERS` array. This makes LiteLLM appear in the provider selection dropdown.

### 2. Settings UI (`webview-ui/src/components/settings/ApiOptions.tsx`)

*   Added a new conditional block ` {selectedProvider === "litellm" && ...}`.
*   Inside this block, added `VSCodeTextField` components for:
    *   LiteLLM API Key (`litellmApiKey`, type="password")
    *   LiteLLM API URL (`litellmApiUrl`, type="url", placeholder="http://localhost:4000")
    *   LiteLLM Model ID (`litellmModelId`, placeholder includes default)
*   Input fields are connected to the configuration state using `handleInputChange`.

## Cost Calculation Notes

*   The cost calculation feature relies on the LiteLLM proxy having cost tracking enabled and the `/spend/calculate` endpoint being available.
*   If the endpoint is unavailable or returns an error, the cost will not be displayed.
*   The accuracy of the cost depends on the pricing information configured within the LiteLLM proxy itself.

## Future Considerations

*   **Model Discovery:** Implement fetching available models directly from the LiteLLM proxy if an endpoint exists.
*   **Error Handling:** Enhance error handling for specific LiteLLM proxy errors.