---
"roo-cline": patch
---

Fix: Decouple Max Output Tokens from Max Thinking Tokens controls

- Separated Max Output Tokens control into its own component that displays for all models with configurable maxTokens
- Updated ThinkingBudget component to only handle thinking/reasoning tokens
- Fixed issue where non-thinking models with configurable maxTokens didn't show the output tokens slider
- Updated to use new model properties (supportsReasoningBudget) from latest main branch
