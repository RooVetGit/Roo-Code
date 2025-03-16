# Seawolf Changelog

## [3.8.8] - 2025-03-15

- Include default .clinerules files in the extension package
- Ensure .clinerules files are automatically referenced and loaded upon installation

## [3.8.6] - 2025-03-13

- Revert SSE MCP support while we debug some config validation issues

## [3.8.5] - 2025-03-12

- Refactor terminal architecture to address critical issues with the current design
- MCP over SSE
- Support for remote browser connections
- Preserve parent-child relationship when cancelling subtasks
- Custom baseUrl for Google AI Studio Gemini
- PowerShell-specific command handling
- OpenAI-compatible DeepSeek/QwQ reasoning support
- Anthropic-style prompt caching in the OpenAI-compatible provider
- Add Deepseek R1 for AWS Bedrock
- Fix MarkdownBlock text color for Dark High Contrast theme
- Add gemini-2.0-pro-exp-02-05 model to vertex
- Bring back progress status for multi-diff edits
- Refactor alert dialog styles to use the correct VS Code theme
- Custom ARNs in AWS Bedrock
- Update MCP servers directory path for platform compatibility
- Fix browser system prompt inclusion rules
- Publish git tags to GitHub from CI
- Fixes to OpenAI-style cost calculations
- Fix to allow using an excluded directory as your working directory
- Kotlin language support in list_code_definition_names tool
- Better handling of diff application errors
- Update Bedrock prices to the latest
- Fixes to OpenRouter custom baseUrl support
- Fix usage tracking for SiliconFlow and other providers that include usage on every chunk
- Telemetry for checkpoint save/restore/diff and diff strategies

## [3.8.4] - 2025-03-09

- Roll back multi-diff progress indicator temporarily to fix a double-confirmation in saving edits
- Add an option in the prompts tab to save tokens by disabling the ability to ask Seawolf to create/edit custom modes

## [3.8.3] - 2025-03-09

- Fix VS Code LM API model picker truncation issue

## [3.8.2] - 2025-03-08

- Create an auto-approval toggle for subtask creation and completion
- Show a progress indicator when using the multi-diff editing strategy
- Add o3-mini support to the OpenAI-compatible provider
- Fix encoding issue where unreadable characters were sometimes getting added to the beginning of files
- Fix issue where settings dropdowns were getting truncated in some cases

## [3.8.1] - 2025-03-07

- Show the reserved output tokens in the context window visualization
- Improve the UI of the configuration profile dropdown
- Fix bug where custom temperature could not be unchecked
- Fix bug where decimal prices could not be entered for OpenAI-compatible providers
- Fix bug with enhance prompt on Sonnet 3.7 with a high thinking budget
- Fix bug with the context window management for thinking models
- Fix bug where checkpoints were no longer enabled by default
- Add extension and VSCode versions to telemetry

## [3.8.0] - 2025-03-07

- Add opt-in telemetry to improve Seawolf faster
- Fix terminal overload / gray screen of death, and other terminal issues
- Add a new experimental diff editing strategy that applies multiple diff edits at once
- Add support for a .seawolfignore to prevent Seawolf from reading/writing certain files, with a setting to also exclude them from search/lists
- Update the new_task tool to return results to the parent task on completion, supporting better orchestration
- Support running Seawolf in multiple editor windows simultaneously
- Make checkpoints asynchronous and exclude more files to speed them up
- Redesign the settings page to make it easier to navigate
- Add credential-based authentication for Vertex AI, enabling users to easily switch between Google Cloud accounts
- Update the DeepSeek provider with the correct baseUrl and track caching correctly
- Add a new “Human Relay” provider that allows manual interaction with a Web AI when needed
- Add observability for OpenAI providers
- Support speculative decoding for LM Studio local models
- Improve UI for mode/provider selectors in chat
- Improve styling of the task headers
- Improve context mention path handling on Windows
