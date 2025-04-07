# Roo-Code-Plus: LiteLLM Provider Integration Plan

## 1. Overview

This document outlines the plan for integrating the LiteLLM API provider into Roo-Code-Plus, based on the Product Requirements Document and analysis of the existing Roo-Code-Plus and Cline codebases. The goal is to mirror Cline's implementation approach while adhering to Roo-Code-Plus patterns and minimizing disruption.

## 2. Key Findings from Code Analysis

*   **API Format:** Cline's LiteLLM provider uses an OpenAI-compatible API format, leveraging the `OpenAI` SDK client and message transformers.
*   **Cost Calculation:** Cline includes logic to calculate costs via a specific LiteLLM `/spend/calculate` endpoint. This will be included in the Roo-Code-Plus implementation.
*   **Base Class:** Roo-Code-Plus providers extend `BaseProvider`; the new `LiteLLMHandler` will follow this pattern.

## 3. Implementation Plan

### Phase 1: Schema & Configuration Setup

1.  **Modify Schema (`src/schemas/index.ts`):**
    *   Add `"litellm"` to the `providerNames` array.
    *   Add the following optional fields to the `providerSettingsSchema` object:
        *   `litellmApiKey: z.string().optional()`
        *   `litellmApiUrl: z.string().optional()` (Default: `http://localhost:4000`)
        *   `litellmModelId: z.string().optional()`
        *   `litellmModelInfo: modelInfoSchema.nullish()`
2.  **Generate Types:** Run `npm run generate-types` to update `src/exports/types.ts`.

### Phase 2: Backend Implementation

1.  **Create Message Transformer (`src/api/transform/litellm-format.ts`):**
    *   Reuse or adapt the existing `convertToOpenAiMessages` function from `src/api/transform/openai-format.ts`.
2.  **Create LiteLLM Provider (`src/api/providers/litellm.ts`):**
    *   Define `LiteLLMHandler` class extending `BaseProvider`.
    *   Define `LiteLLMHandlerOptions` interface.
    *   Implement the constructor:
        *   Accept options (`litellmApiKey`, `litellmApiUrl`, `litellmModelId`, `litellmModelInfo`).
        *   Initialize the `OpenAI` SDK client with the appropriate `baseURL` and `apiKey`.
    *   Implement `calculateCost` method:
        *   Add logic to call the `/spend/calculate` endpoint on the configured LiteLLM server using `fetch` or `axios`.
        *   Handle potential errors gracefully.
    *   Implement `createMessage`:
        *   Use the message transformer.
        *   Send the request using the initialized `OpenAI` client.
        *   Handle streaming responses, yielding `ApiStream` chunks (text, usage, errors).
        *   Call `calculateCost` and include the `totalCost` in the yielded `usage` chunk.
    *   Implement `getModel`: Return the configured `litellmModelId` and `litellmModelInfo` (or defaults).
    *   Rely on the default `countTokens` implementation from `BaseProvider`.
3.  **Register Provider (`src/api/index.ts`):**
    *   Import `LiteLLMHandler`.
    *   Add a `case "litellm": return new LiteLLMHandler(options);` within the `switch` statement in the `buildApiHandler` function.

### Phase 3: Frontend (UI) Implementation

1.  **Locate UI Components:** Identify relevant components in `webview-ui/src/components/` for provider selection and settings.
2.  **Update Provider Selection UI:** Add "LiteLLM" to the list/dropdown of available API providers.
3.  **Create/Extend Settings UI:**
    *   Add input fields for "LiteLLM API Key" (password), "LiteLLM API URL" (text), and "LiteLLM Model ID" (text).
    *   Connect fields to the configuration management system (e.g., `ProviderSettingsManager`).
    *   Add basic validation (e.g., URL format).
    *   Ensure visual consistency with existing settings panels.

### Phase 4: Documentation

1.  **Create/Update Documentation Files:** Follow the structure in PRD Section 10.1 within the `docs/` folder:
    *   `docs/roo-code-plus/litellm-integration.md`: Detail backend logic, API interaction, transformation, and cost calculation.
    *   `docs/roo-code-plus/ui-changes.md`: Document frontend modifications.
    *   `docs/roo-code-plus/configuration.md`: Explain new `litellm*` settings.
    *   `docs/roo-code-plus/changes/file-modifications.md`: List modified files.
    *   `docs/user-guides/litellm-setup.md`: Write setup/usage instructions.
    *   Update `docs/roo-code-plus/decisions.md` and `docs/roo-code-plus/changelog.md`.
2.  **Code Comments:** Add JSDoc comments to new classes, methods, and complex logic.

### Phase 5: Testing

1.  **Execute Test Strategy:** Perform unit, integration, end-to-end, regression, and manual testing as outlined in PRD Section 7.
2.  **Specific Focus:**
    *   Correct provider selection and configuration persistence.
    *   Successful API communication (valid/invalid credentials).
    *   Correct streaming behavior and response parsing.
    *   Proper error handling and UI display.
    *   **Correctness of `calculateCost` method and `totalCost` in stream output.**
    *   No regressions in other providers or core functionality.

## 4. Visual Plan (Mermaid)

```mermaid
graph TD
    A[Start: PRD Analysis] --> B{Information Gathering};
    B --> C[Analyze `src/api/providers/`];
    B --> D[Analyze `src/api/index.ts`];
    B --> E[Analyze `src/schemas/index.ts`];
    B --> F[Analyze `src/shared/api.ts`];
    B --> F2[Analyze Cline `litellm.ts`];

    subgraph Phase 1: Schema
        G[Modify `providerNames` in `schemas/index.ts`]
        H[Add `litellm*` fields to `providerSettingsSchema` in `schemas/index.ts`]
        I[Run `npm run generate-types`]
    end

    subgraph Phase 2: Backend
        J[Reuse/Adapt `openai-format.ts` Transformer]
        K[Create `LiteLLMHandler` extending `BaseProvider` in `litellm.ts`]
        K1[Implement Cost Calculation logic in `LiteLLMHandler`]
        L[Register `LiteLLMHandler` in `api/index.ts`]
    end

    subgraph Phase 3: Frontend
        M[Locate UI Components in `webview-ui/`]
        N[Update Provider Selection UI]
        O[Create/Extend LiteLLM Settings Panel UI]
    end

    subgraph Phase 4: Documentation
        P[Create/Update Docs in `docs/`]
        P1[Document Cost Calculation]
        Q[Add Code Comments (JSDoc)]
    end

    subgraph Phase 5: Testing
        R[Unit Tests]
        S[Integration Tests]
        T[E2E Tests]
        U[Regression Tests]
        V[Manual Tests]
        V1[Add Cost Calculation Tests]
    end

    W[End: Feature Complete & Documented]

    C & D & E & F & F2 --> G;
    G --> H;
    H --> I;
    I --> J;
    J --> K;
    K --> K1;
    K1 --> L;
    L --> M;
    M --> N;
    N --> O;
    O --> P;
    P --> P1;
    P1 --> Q;
    Q --> R;
    R & S & T & U & V & V1 --> W;