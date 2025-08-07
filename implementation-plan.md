# Implementation Plan: Add Optional Mode Parameter for Slash Commands

## Overview

Add support for an optional `mode` parameter in slash command markdown files that will automatically trigger a mode switch when the slash command is executed.

## Current Architecture Understanding

### 1. Command System

- Commands are stored as markdown files in `.roo/commands/` directory
- Commands support frontmatter with `description` and `argument-hint` fields
- Commands are loaded by `src/services/command/commands.ts`
- Command interface is defined in `src/services/command/commands.ts`

### 2. Slash Command Flow

- User types `/command` in the chat
- `ChatTextArea` component shows autocomplete menu with available commands
- When selected, the command text is inserted into the input
- Commands are processed when the message is sent

### 3. Mode Switching

- Modes can be switched via the mode selector dropdown
- Mode switching sends a `mode` message to the backend via `vscode.postMessage`
- The `setMode` function updates the current mode state

## Implementation Steps

### Step 1: Update Command Interface

**File:** `src/services/command/commands.ts`

- Add optional `mode?: string` field to the `Command` interface
- Update the frontmatter parsing to extract the `mode` field

### Step 2: Update Command Loading

**File:** `src/services/command/commands.ts`

- Modify `scanCommandDirectory` and `tryLoadCommand` functions
- Parse the `mode` field from frontmatter (similar to `description` and `argument-hint`)

### Step 3: Update Frontend Command Handling

**File:** `webview-ui/src/components/chat/ChatTextArea.tsx`

- Modify the `handleMentionSelect` function for `ContextMenuOptionType.Command`
- Check if the selected command has a `mode` property
- If it does, trigger mode switch before inserting the command

### Step 4: Pass Mode Information to Frontend

**File:** `src/core/webview/webviewMessageHandler.ts`

- Update the command list sent to frontend to include the `mode` field
- Ensure the `Command` type in `src/shared/ExtensionMessage.ts` includes the mode field

### Step 5: Update Context Menu

**File:** `webview-ui/src/utils/context-mentions.ts`

- Ensure the command's mode is passed through when creating menu options
- Update the `ContextMenuQueryItem` type if needed

## Example Usage

A command markdown file with mode specification:

```markdown
---
description: Deploy the application to production
argument-hint: <environment>
mode: architect
---

# Deploy Command

This command helps you deploy the application...
```

When this command is selected:

1. The mode automatically switches to "architect"
2. The command `/deploy` is inserted into the input
3. The user can continue typing arguments

## Testing Requirements

1. **Unit Tests:**

    - Test command loading with mode parameter
    - Test command loading without mode parameter (backward compatibility)
    - Test mode switching when command is selected

2. **Integration Tests:**
    - Test full flow from command selection to mode switch
    - Test that commands without mode don't trigger mode switch
    - Test that invalid mode values are handled gracefully

## Backward Compatibility

- Commands without the `mode` field should work as before
- Existing command files don't need to be updated
- The feature is entirely optional

## Benefits

1. **Improved UX:** Users don't need to manually switch modes for mode-specific commands
2. **Workflow Optimization:** Commands can be pre-configured for the most appropriate mode
3. **Discoverability:** Users learn which modes are best for which commands
