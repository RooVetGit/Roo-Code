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