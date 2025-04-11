# OpenAI Compatible Context Window Override Plan

## Objective

Allow users to configure the context window size for the "OpenAI Compatible" LLM provider type via the settings UI, overriding the default 128k limit.

## Implementation Strategy

Use a fixed-step slider UI element in the provider settings.

## Plan Steps

1.  **Schema Modification (`src/schemas/index.ts`):**
    *   Add an optional property `openAiContextWindowOverride?: number;` to the relevant settings interface (likely `ProviderSettings` or a derived type). This field will store the user-selected token value (e.g., 8192, 32768) or `undefined` if the default is chosen.

2.  **Backend Provider Logic Update (`src/api/providers/openai.ts`):**
    *   Modify the `OpenAiHandler.getModel()` method.
    *   Retrieve the base `ModelInfo` (from `openAiCustomModelInfo` or `openAiModelInfoSaneDefaults`).
    *   If `this.options.openAiContextWindowOverride` is defined and valid, create a new `ModelInfo` object by copying the base info and setting `contextWindow` to the override value.
    *   Return the potentially modified `ModelInfo`.

3.  **UI Settings Update (Likely `webview-ui/src/components/Settings/ProviderSettings/OpenAISettings.tsx`):**
    *   Add a `Slider` component with 7 discrete steps (0 to 6).
    *   Map slider steps to token override values:
        *   `0`: Default (sets override to `undefined`, effectively 128k)
        *   `1`: 8k (sets override to `8192`)
        *   `2`: 32k (sets override to `32768`)
        *   `3`: 128k (sets override to `131072`)
        *   `4`: 512k (sets override to `524288`)
        *   `5`: 1M (sets override to `1048576`)
        *   `6`: 2M (sets override to `2097152`)
    *   Bind the slider's value to the `openAiContextWindowOverride` setting (mapping back and forth between the 0-6 scale and the token/undefined values).
    *   Add a "Context Window Override" label.
    *   Add a dynamic text display showing the selected token value (e.g., "Selected: 32k tokens", "Selected: Default (128k)").
    *   Position this control after the model selection element.

4.  **UI Chat Display Verification (Likely `webview-ui/src/components/Chat/ContextWindowProgress.tsx`):**
    *   Ensure the component displaying the context size during chat correctly uses the `contextWindow` property from the `ModelInfo` object provided by the backend. No changes are expected if it already does this.

5.  **Core Logic Verification (e.g., `src/core/sliding-window/index.ts`):**
    *   Confirm that components like the sliding window manager consume the `contextWindow` value from the provider's `getModel().info` result. The override should propagate automatically.

6.  **Internationalization (i18n):**
    *   Add new keys to `webview-ui/src/i18n/locales/en/settings.json` for the label ("Context Window Override") and the dynamic display text.
    *   Add placeholders or translations to other locale files as needed.
  
   ## Context Limit Usage
  
   *   **Verification Result:** Analysis of `src/core/sliding-window/index.ts` confirmed that the `contextWindow` value (including the override) is actively used by the `truncateConversationIfNeeded` function to determine when conversation history should be truncated before sending it to the API. It does not block requests but shortens the history based on the limit and buffer settings.
  
   ## Target Files

*   `src/schemas/index.ts`
*   `src/api/providers/openai.ts`
*   `webview-ui/src/components/Settings/ProviderSettings/OpenAISettings.tsx` (or similar)
*   `webview-ui/src/components/Chat/ContextWindowProgress.tsx` (for verification)
*   `webview-ui/src/i18n/locales/en/settings.json`
*   `webview-ui/src/i18n/locales/*/settings.json` (as needed)