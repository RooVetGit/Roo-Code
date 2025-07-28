# Sticky Mode Fix Summary

## Problem

When a child task was created using the `new_task` tool and its mode was set, this action unintentionally overwrote the saved mode of its parent task in the task history. This happened because the `saveClineMessages` method in `Task.ts` was fetching the current mode from the `ClineProvider`'s transient state, which would be the child's mode when a child task was active.

## Root Cause

The `saveClineMessages` method was calling `taskMetadata` with `mode: (await this.providerRef.deref()?.getState())?.mode`, which retrieved the current provider state rather than the task's own mode.

## Solution

Made each `Task` instance responsible for tracking its own mode:

1. **Added `taskMode` property to Task class** (`src/core/task/Task.ts`):

    - Stores the mode specific to each task instance
    - Initialized from `historyItem.mode` for resumed tasks
    - Fetched from provider state for new tasks

2. **Updated `saveClineMessages` method** (`src/core/task/Task.ts`):

    - Changed from `mode: (await this.providerRef.deref()?.getState())?.mode`
    - To `mode: this.taskMode`
    - Ensures each task saves its own mode to history

3. **Added comprehensive test coverage** (`src/core/task/__tests__/Task.sticky-mode.spec.ts`):
    - Tests that task mode is preserved when saving messages
    - Tests that parent task mode is not affected by child task mode changes
    - Tests error handling when provider state is unavailable
    - Tests restoration of mode from history

## Files Modified

- `src/core/task/Task.ts` - Added taskMode property and updated saveClineMessages
- `src/core/task/__tests__/Task.sticky-mode.spec.ts` - Added comprehensive test coverage

## Test Results

All tests pass successfully:

- Task sticky mode tests: 6 passed
- ClineProvider sticky mode tests: 8 passed

The fix ensures that each task maintains its own mode throughout its lifecycle, preventing child tasks from interfering with parent task state.
