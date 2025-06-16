---
"roo-cline": patch
---

Add setting to disable diff visualization to prevent LSP crashes

Added a new setting `disableDiffVisualization` that allows users to disable the diff view when editing files. When enabled, files will open directly in the editor instead of showing a side-by-side diff view. This helps prevent Language Server Protocol (LSP) crashes that can occur with very large files, particularly affecting C# developers. The changes made by Roo are still visible in the chat window.
