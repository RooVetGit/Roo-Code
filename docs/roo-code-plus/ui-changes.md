# LiteLLM Integration: UI Changes

This document outlines the user interface modifications made to Roo-Code-Plus to support the LiteLLM provider.

## Settings View

### 1. Provider Selection Dropdown

*   **File:** `webview-ui/src/components/settings/constants.ts`
*   **Change:** Added a new entry `{ value: "litellm", label: "LiteLLM" }` to the `PROVIDERS` array.
*   **Effect:** "LiteLLM" now appears as a selectable option in the "API Provider" dropdown within the settings panel.

### 2. Provider-Specific Options

*   **File:** `webview-ui/src/components/settings/ApiOptions.tsx`
*   **Change:** Added a new conditional rendering block for when `selectedProvider === "litellm"`.
*   **Effect:** When "LiteLLM" is selected as the provider, the following configuration fields are displayed:
    *   **API Key:** A `VSCodeTextField` of type "password" linked to the `litellmApiKey` configuration setting. Uses the translation key `settings:providers.liteLLM.apiKey`. Includes standard storage notice.
    *   **LiteLLM API URL:** A `VSCodeTextField` of type "url" linked to the `litellmApiUrl` configuration setting. Uses the translation key `settings:providers.liteLLM.apiUrl`. Includes `http://localhost:4000` as a placeholder.
    *   **Model:** A standard `VSCodeTextField` linked to the `litellmModelId` configuration setting. Uses the generic translation key `settings:providers.modelId`. Includes a placeholder indicating the default model ID (`gpt-3.5-turbo`).

### 3. Styling and Layout

*   The new input fields for LiteLLM follow the existing styling and layout patterns used for other providers within `ApiOptions.tsx`, ensuring visual consistency. Standard labels, placeholders, and spacing are used.
*   Added translation keys `settings:providers.liteLLM.apiKey` and `settings:providers.liteLLM.apiUrl` to `webview-ui/src/i18n/locales/en/settings.json`.