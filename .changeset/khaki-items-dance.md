---
"roo-cline": patch
---

This change fixes a bug where file paths containing spaces or special characters were not properly escaped, leading to failures in mention highlighting and file access. The problem affects utility functions like `convertToMentionPath` and `insertMention`, causing inconsistent behavior across different operating systems. Resolving this ensures better reliability for users dealing with common file naming conventions, improving overall user experience in path referencing.
