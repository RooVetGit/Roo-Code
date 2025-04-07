# Design Decisions Log

This document records significant design decisions made during the development of Roo-Code-Plus features.

## LiteLLM Provider Integration (April 2025)

*   **Integration Approach:** Mirror Cline's implementation by using the `OpenAI` SDK client to interact with LiteLLM's OpenAI-compatible endpoint. This minimizes changes and leverages existing patterns.
*   **Base Class:** The `LiteLLMHandler` will extend Roo-Code-Plus's `BaseProvider` class (`src/api/providers/base-provider.ts`) to ensure consistency with other providers, even though Cline's implementation did not use a base class.
*   **Message Transformation:** Reuse the existing `convertToOpenAiMessages` transformer (`src/api/transform/openai-format.ts`, copied to `litellm-format.ts`) due to the OpenAI-compatible nature of the LiteLLM proxy API.
*   **Configuration:** Integrate settings (`litellmApiKey`, `litellmApiUrl`, `litellmModelId`, `litellmModelInfo`) into the existing `providerSettingsSchema` (`src/schemas/index.ts`) for consistency. Defaults (`http://localhost:4000` for URL, `noop` for key, `gpt-3.5-turbo` for model ID) are provided based on common usage and Cline's implementation.
*   **Cost Calculation:** Include the cost calculation logic from Cline, which queries the `/spend/calculate` endpoint on the LiteLLM proxy. This provides feature parity but relies on the user having cost tracking enabled in their LiteLLM setup. The cost is added to the `usage` chunk yielded by the stream.
*   **Token Counting:** Utilize the default `tiktoken`-based `countTokens` method inherited from `BaseProvider`. No custom LiteLLM token counting endpoint was identified or deemed necessary for this initial integration.
*   **UI:** Add LiteLLM to the existing provider dropdown (`PROVIDERS` constant) and add specific input fields to the `ApiOptions.tsx` component, maintaining visual consistency.