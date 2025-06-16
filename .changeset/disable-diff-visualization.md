---
"roo-cline": patch
---

Add experimental setting to disable diff visualization for all edit tools

Added a new experimental setting `disableDiffVisualization` that allows users to disable diff visualization for all edit tools (write_to_file, apply_diff, insert_content, search_and_replace). When enabled, files will open directly in the editor instead of showing a side-by-side diff view. This helps prevent Language Server Protocol (LSP) crashes that can occur with very large files, particularly affecting C# developers. The changes made by Roo are still visible in the chat window.
