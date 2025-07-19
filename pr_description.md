## Description

Fixes #5633

This PR resolves the critical HTML entity escaping/unescaping issue that was causing diff search/replace operations to fail or produce unintended content modifications.

## Problem

The apply_diff tools were unescaping HTML entities (e.g., &amp; → &) in search content for non-Claude models, but the actual file content still contained the escaped entities. This caused:

1. **Search failures**: When LLMs provided search content with HTML entities, the unescaping made it not match the actual file content
2. **Unintended modifications**: Partial matches could lead to incorrect replacements in files

## Solution

- **Removed HTML entity unescaping logic** from applyDiffTool.ts and multiApplyDiffTool.ts for non-Claude models
- **Preserved HTML entities** in search content to ensure exact matching with file content
- **Removed unused imports** of unescapeHtmlEntities from both files
- **Added comprehensive test coverage** to prevent regression

## Changes Made

- src/core/tools/applyDiffTool.ts:

    - Removed HTML entity unescaping for non-Claude models (lines 26-28)
    - Removed unused import of unescapeHtmlEntities (line 13)

- src/core/tools/multiApplyDiffTool.ts:

    - Replaced HTML entity unescaping logic with simple assignment (lines 414-418)
    - Removed unused import of unescapeHtmlEntities (line 13)

- src/core/tools/**tests**/applyDiffHtmlEntity.spec.ts:
    - Added comprehensive test suite with 5 test cases
    - Tests verify HTML entities are preserved in search/replace operations
    - Tests cover various entity types: &amp;, &lt;, &gt;, &apos;, &quot;
    - Tests verify both Claude and non-Claude model behavior

## Testing

- [x] All existing tests pass
- [x] Added comprehensive tests for HTML entity handling scenarios:
    - [x] HTML entities preserved in search content for non-Claude models
    - [x] HTML entities still unescaped for Claude models (backward compatibility)
    - [x] Various entity types tested (&amp;, &lt;, &gt;, &apos;, &quot;)
    - [x] Both single and multiple entity scenarios covered
- [x] Manual testing completed:
    - [x] Verified search operations work with HTML entities in content
    - [x] Confirmed no unintended content modifications occur
- [x] All linting and type checking passes

## Verification of Acceptance Criteria

- [x] **Search failures resolved**: HTML entities in search content now match file content exactly
- [x] **Unintended modifications prevented**: No more partial matches causing incorrect replacements
- [x] **Backward compatibility maintained**: Claude model behavior unchanged
- [x] **No regressions**: All existing functionality preserved
- [x] **Comprehensive test coverage**: Edge cases and scenarios covered

## Related Issues

This issue was previously attempted to be fixed in:

- PR #5608 (closed without merging)
- Issue #4077 (related HTML entity handling)

This PR provides a complete and tested solution that addresses the root cause.

## Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] Documentation updated (test documentation)
- [x] No breaking changes
- [x] All tests passing
- [x] Linting and type checking passes
