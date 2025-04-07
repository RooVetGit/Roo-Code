# User Guide: Setting Up the LiteLLM Provider

This guide explains how to configure Roo-Code-Plus to use the LiteLLM provider, allowing you to connect to various Large Language Models (LLMs) through a LiteLLM proxy server.

## Prerequisites

*   **Running LiteLLM Proxy:** You need a running instance of the [LiteLLM proxy server](https://docs.litellm.ai/docs/proxy_server). Make sure you know its URL (e.g., `http://localhost:4000`) and any required API key.
*   **Model Configuration in LiteLLM:** Ensure the specific LLM you want to use (e.g., `gpt-4`, `ollama/llama2`, `claude-2`) is correctly configured in your LiteLLM proxy's configuration file (`config.yaml`).

## Configuration Steps

1.  **Open Roo-Code-Plus Settings:**
    *   Go to VS Code Settings (File > Preferences > Settings or `Cmd+,`/`Ctrl+,`).
    *   Search for "RooCode".
    *   Find the "Roo Code: Api Configuration" section. If you use multiple configurations, select the one you want to modify or create a new one.

2.  **Select LiteLLM Provider:**
    *   In the "Api Provider" dropdown, select "LiteLLM".

3.  **Enter LiteLLM Settings:**
    *   **LiteLLM API URL:** Enter the base URL of your running LiteLLM proxy server. If it's running locally on the default port, you might leave this blank or enter `http://localhost:4000`.
    *   **API Key:** If your LiteLLM proxy requires an API key for authentication, enter it here. Otherwise, leave it blank.
    *   **Model Name:** Enter the exact model string that your LiteLLM proxy expects for the model you want to use. This typically includes the provider prefix. Examples:
        *   `gpt-3.5-turbo` (for OpenAI models via LiteLLM)
        *   `ollama/llama3` (for an Ollama model via LiteLLM)
        *   `bedrock/anthropic.claude-3-sonnet-20240229-v1:0` (for a Bedrock model via LiteLLM)
        *   Refer to your LiteLLM proxy configuration (`config.yaml`) for the correct model strings.

4.  **Save Settings:** Your changes should save automatically.

## Verification

*   Start a new chat with Roo-Code-Plus.
*   It should now use the model specified via your LiteLLM proxy.
*   If you encounter errors, double-check:
    *   The LiteLLM proxy server is running and accessible from VS Code.
    *   The API URL and API Key (if applicable) are correct.
    *   The Model ID exactly matches a model configured in your LiteLLM proxy.
    *   Consult the LiteLLM proxy server logs for more detailed error information.

## Cost Tracking

If your LiteLLM proxy has cost tracking enabled, Roo-Code-Plus will attempt to fetch cost information for each request and display it in the chat history. This requires the `/spend/calculate` endpoint to be active on the proxy.