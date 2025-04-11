# LiteLLM Integration: Configuration

This document explains how the LiteLLM provider utilizes Roo-Code-Plus's existing configuration system.

## Configuration Storage

LiteLLM settings are stored within the standard Roo-Code-Plus configuration mechanism, typically managed via the VS Code settings UI or directly in `settings.json`. They are part of the `rooCode.apiConfiguration` object (or the specific named configuration object if multiple are used).

## New Configuration Settings

The following settings have been added to support the LiteLLM provider. They are all optional.

*   **`rooCode.apiConfiguration.litellmApiKey`** (`string`, optional):
    *   The API key required by your LiteLLM proxy instance, if authentication is enabled.
    *   If omitted, the provider sends `"noop"` as the key (matching Cline's behavior).
    *   Stored securely in VS Code's SecretStorage.

*   **`rooCode.apiConfiguration.litellmApiUrl`** (`string`, optional):
    *   The base URL of your running LiteLLM proxy instance.
    *   Defaults to `"http://localhost:4000"` if not specified.
    *   Example: `"http://192.168.1.100:8000"`

*   **`rooCode.apiConfiguration.litellmModelId`** (`string`, optional):
    *   Specifies the model string that Roo-Code-Plus should request from the LiteLLM proxy. This string typically includes the provider prefix and model name recognized by LiteLLM.
    *   Defaults to `"gpt-3.5-turbo"` if not specified.
    *   Examples: `"gpt-4"`, `"ollama/llama2"`, `"bedrock/anthropic.claude-v2"`

*   **`rooCode.apiConfiguration.litellmModelInfo`** (`object`, optional):
    *   Allows overriding the default `ModelInfo` (context window, token limits, etc.) for the selected LiteLLM model. This is generally not needed unless the default placeholders are inaccurate for your specific underlying model.
    *   Structure follows the `ModelInfo` schema defined in `src/schemas/index.ts`.

## Integration with Existing System

*   The `apiProvider` setting should be set to `"litellm"` to activate this provider.
*   LiteLLM settings follow the same pattern as other providers, ensuring consistency.
*   Existing configurations without LiteLLM settings remain valid and functional.

## OpenAI Compatible Provider Settings

The following settings are relevant when `apiProvider` is set to `"openai"`.

*   **`rooCode.apiConfiguration.openAiBaseUrl`** (`string`, optional):
	*   The base URL of the OpenAI-compatible API endpoint.
	*   Required. Example: `"https://api.mistral.ai/v1"`

*   **`rooCode.apiConfiguration.openAiApiKey`** (`string`, optional):
	*   The API key for the endpoint.
	*   Stored securely in VS Code's SecretStorage.

*   **`rooCode.apiConfiguration.openAiModelId`** (`string`, optional):
	*   The specific model ID to use with the endpoint.
	*   Example: `"mistral-large-latest"`, `"gpt-4o"`

*   **`rooCode.apiConfiguration.openAiContextWindowOverride`** (`number`, optional):
	*   Allows overriding the default context window size (128k tokens) assumed for compatible endpoints.
	*   Set via a slider in the UI (Default, 8k, 32k, 128k, 512k, 1M, 2M tokens).
	*   If set, this value is used for determining when to truncate conversation history. If unset (`undefined`), the default 128k is used.

*   **`rooCode.apiConfiguration.openAiCustomModelInfo`** (`object`, optional):
	*   Allows overriding other `ModelInfo` properties like `maxTokens`, `supportsImages`, pricing, etc., for the specified `openAiModelId`.
	*   The `openAiContextWindowOverride` takes precedence over the `contextWindow` value within `openAiCustomModelInfo` if both are set.

*   **`rooCode.apiConfiguration.openAiUseAzure`** (`boolean`, optional):
	*   Set to `true` if connecting to an Azure OpenAI endpoint.

*   **`rooCode.apiConfiguration.azureApiVersion`** (`string`, optional):
	*   Specifies the API version for Azure OpenAI endpoints.

*   **`rooCode.apiConfiguration.openAiHostHeader`** (`string`, optional):
	*   Allows setting a custom `Host` HTTP header, sometimes required by proxy services.

*   **`rooCode.apiConfiguration.openAiLegacyFormat`** (`boolean`, optional):
	*   Set to `true` if the endpoint requires the older OpenAI message format (less common).

*   **`rooCode.apiConfiguration.openAiR1FormatEnabled`** (`boolean`, optional):
	*   Set to `true` for models requiring specific R1 formatting (e.g., DeepSeek Reasoner).

*   **`rooCode.apiConfiguration.openAiStreamingEnabled`** (`boolean`, optional):
	*   Defaults to `true`. Set to `false` if the endpoint does not support streaming responses.