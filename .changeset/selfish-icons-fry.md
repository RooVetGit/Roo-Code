---
"roo-cline": patch
---

Ensure TerminalProcess respects user line limit setting

This commit fixes the terminal output line limiting functionality in TerminalProcess.ts:

1. Fixed the implementation to properly access the user's configured terminal output line limit through the sidebarProvider state
2. Added graceful fallback to default limit (1000 lines) when user settings are unavailable
3. Added detailed debug logging to help diagnose state access issues
4. Modified tests to focus on validating line limiting behavior
5. Added comprehensive documentation to explain how line limit settings are accessed and applied

The fix ensures the terminal output window properly respects user settings for line limits, preventing excessive memory usage while maintaining the exact number of lines configured by the user.
