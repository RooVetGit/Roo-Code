# Test Plan for Auto-Focus Chat Input Feature

## Changes Made:

1. **ChatView.tsx** - Modified `startNewTask` function to focus textarea after clearing task
2. **ClineProvider.ts** - Added focus action after showing task with ID
3. **webviewMessageHandler.ts** - Added focus action after creating new task

## Test Scenarios:

### 1. New Task Creation

- Click "Start New Task" button
- Expected: Chat input should automatically receive focus

### 2. Opening Past Task from History

- Click on a task from history
- Expected: Chat input should automatically receive focus after task loads

### 3. Focus Action Handler

- The existing `focusInput` action handler in ChatView.tsx (line 720) will handle the focus request

## Implementation Details:

- Used `setTimeout` with 100ms delay in `startNewTask` to ensure DOM is ready
- Used `postMessageToWebview` with `focusInput` action for consistent focus handling
- Leveraged existing focus infrastructure in the codebase
