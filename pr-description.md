## Context

This PR fixes issue #3199 where pasting text in the chat would sometimes paste into the terminal instead. Users reported that when trying to copy and paste text into the Roo Code chat box, it would instead be pasted into the terminal, causing confusion and disrupting workflow.

## Implementation

The root cause of this issue was that the focus was not being properly restored to the webview after terminal operations. The fix adds explicit focus restoration to the webview after terminal operations complete, ensuring that the focus returns to the chat input after terminal commands are executed.

Additionally, I fixed a problematic `$esbuild-watch` reference in tasks.json by changing it to `$tsc-watch`, and added a simplified launch configuration for easier debugging. These changes improve the development experience and make it easier to test the fix.

## Screenshots

| before                                            | after                                     |
| ------------------------------------------------- | ----------------------------------------- |
| Pasting text would go to terminal instead of chat | Pasting text correctly goes to chat input |

## How to Test

- Open Roo Code and start a conversation
- Execute a terminal command (e.g., `ls` or `dir`)
- After the command completes, try to paste text into the chat input
- Verify that the text is pasted into the chat input and not into the terminal
- Try this multiple times to ensure consistency

## Get in Touch

Discord: mnehm
