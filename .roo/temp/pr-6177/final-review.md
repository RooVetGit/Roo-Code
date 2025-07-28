# PR Review Summary for #6177: Implement Sticky Task Mode

## Executive Summary

This PR implements a "sticky mode" feature that persists the last used mode when reopening a task from history. While the implementation is functional and follows existing patterns, there are critical issues with test coverage and some minor architectural concerns that should be addressed.

## Critical Issues (must fix)

### 1. **Breaking Change in new_task Tool**

The current implementation has a critical issue with the `new_task` tool that will break with sticky mode:

**Problem:** In [`newTaskTool.ts`](src/core/tools/newTaskTool.ts:84), the mode is switched BEFORE creating the new task:

```typescript
// Line 84: Switch mode first, then create new task instance.
await provider.handleModeSwitch(mode)
```

With sticky mode, this means:

1. Parent task switches to the new mode
2. Parent task's mode is saved as the new mode (not its original mode)
3. When the subtask completes and parent resumes, it will have the wrong mode

**Required Fix:** The mode switch must happen AFTER the new task is created:

```typescript
// Create new task first (preserving parent's current mode)
const newCline = await provider.initClineWithTask(unescapedMessage, undefined, cline)

// Then switch the new task to the desired mode
await provider.handleModeSwitch(mode)
```

This ensures the parent task's mode is preserved correctly in its history.

### 2. **Missing Test Coverage for Core Functionality**

The PR lacks specific tests for the new sticky mode feature:

- No tests verify that the mode is correctly saved to `taskMetadata` when switching modes
- No tests verify that the mode is restored when reopening a task from history
- The existing test files (`Task.spec.ts` and `ClineProvider.spec.ts`) were not updated to cover the new functionality

**Evidence:**

- Searched for `handleModeSwitch`, `initClineWithHistoryItem`, and `taskMetadata` in test files
- Found no tests specifically validating the persistence and restoration of mode in task metadata

**Recommendation:** Add comprehensive test coverage:

```typescript
// In ClineProvider.spec.ts
it("should save mode to task metadata when switching modes", async () => {
	// Test that handleModeSwitch updates task history with new mode
})

it("should restore mode from history item when reopening task", async () => {
	// Test that initClineWithHistoryItem restores the saved mode
})

// In Task.spec.ts
it("should include current mode in task metadata", async () => {
	// Test that saveClineMessages includes mode in metadata
})
```

## Pattern Inconsistencies

### 1. **Inconsistent Mode Persistence Approach**

The implementation adds mode persistence at the task level, but the codebase already has a pattern for persisting mode-specific API configurations (`modeApiConfigs`). This creates two different approaches for mode-related persistence.

**Current patterns:**

- Mode-specific API configs: `providerSettingsManager.setModeConfig()`
- Task-specific mode: Added to `HistoryItem` and `taskMetadata`

**Recommendation:** Document why task-level mode persistence is needed in addition to the existing mode configuration system.

## Architecture Concerns

### 1. **Tight Coupling Between Task and Mode**

The implementation creates a direct dependency between tasks and modes by adding the `mode` field to `HistoryItem`. This could make it harder to refactor the mode system in the future.

**Consider:** Using a more flexible approach like storing mode in a separate metadata object that could be extended with other task preferences in the future.

## Minor Suggestions

### 1. **Type Safety Enhancement**

The `mode` field is typed as `string` in both `HistoryItem` and `taskMetadata`. Consider using the `Mode` type for better type safety:

```typescript
// In packages/types/src/history.ts
mode: z.enum(['code', 'architect', 'ask', 'debug', ...]).optional()
```

### 2. **Documentation**

Add JSDoc comments to explain the purpose of the mode field:

```typescript
/**
 * The mode that was active when this task was last saved.
 * Used to restore the user's preferred mode when reopening the task.
 */
mode?: string
```

## Test Coverage Issues

The PR claims "All existing tests pass" but provides no new tests for the feature. This is concerning for a feature that modifies core task persistence behavior.

**Required tests:**

1. Mode is saved when task history is updated
2. Mode is restored when task is reopened
3. Mode persistence works correctly with subtasks
4. Null/undefined mode is handled gracefully

## Summary

This PR has two critical issues that must be addressed:

1. **The new_task tool implementation is incompatible with sticky mode** - The mode switch happens before task creation, which will cause the parent task to save the wrong mode. This is a breaking change that will affect subtask functionality.

2. **Complete lack of test coverage** - The feature modifies important task persistence behavior without any tests to ensure it works correctly or to prevent regressions.

**Verdict:** Request changes - Fix the new_task tool implementation and add comprehensive test coverage before merging.

## Additional Implementation Notes

The fix for the new_task tool should:

1. Create the new task first (which will preserve the parent's current mode in its history)
2. Then switch the newly created task to the desired mode
3. This ensures parent tasks maintain their original mode when resuming after subtasks complete
