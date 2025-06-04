# Codebase Search Enforcement Documentation

## Overview

This document describes the mechanisms implemented to ensure that the `codebase_search` tool is properly utilized as the first line of understanding when working with codebase context in Roo Code.

## Implementation Details

### 1. Tool Use Guidelines Section

**File**: `src/core/prompts/sections/tool-use-guidelines.ts`

The function now accepts a `CodeIndexManager` parameter to conditionally include codebase_search enforcement:
- When codebase_search is available: **IMPORTANT: When starting a new task or when you need to understand existing code/functionality, you MUST use the `codebase_search` tool FIRST before any other search tools.**
- When unavailable: Standard tool selection guidance without codebase_search enforcement
- Maintains proper numbering regardless of availability

### 2. Objective Section

**File**: `src/core/prompts/sections/objective.ts`

Enhanced the thinking process in step 3 with conditional enforcement:
- When codebase_search is available: Requires using `codebase_search` tool first if the task involves understanding existing code or functionality
- When unavailable: Proceeds directly to analyzing file structure
- Integrated into the <thinking> tags analysis workflow

### 3. Rules Section

**File**: `src/core/prompts/sections/rules.ts`

Added a conditional critical rule:
- When codebase_search is available: **CRITICAL: When you need to understand existing code or functionality, ALWAYS use the `codebase_search` tool FIRST before using search_files or other file exploration tools.**
- When unavailable: No codebase_search rule is included
- search_files guidance adjusts accordingly (mentions "after codebase_search" only when available)

### 4. Mode-Specific Instructions

**File**: `src/shared/modes.ts`

Updated the architect mode's custom instructions:
- Modified step 1 to explicitly state: **ALWAYS start with the `codebase_search` tool (if available) to understand existing functionality and code structure before using other tools like read_file or search_files.**
- This ensures that even in architect mode, which is focused on planning, the codebase_search tool is prioritized when available

### 5. System Prompt Integration

**File**: `src/core/prompts/system.ts`

Updated to pass `CodeIndexManager` to the relevant sections:
- `getToolUseGuidelinesSection(codeIndexManager)`
- `getObjectiveSection(codeIndexManager)`
- `getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy, codeIndexManager)`

## How It Works

The enforcement works through multiple layers:

1. **Conditional Availability Check**: The system checks if `CodeIndexManager` is enabled, configured, and initialized before including codebase_search guidance.

2. **System Prompt Level**: The tool use guidelines and objective sections conditionally include codebase_search enforcement based on availability.

3. **Mode-Specific Level**: Individual modes (like architect) have their custom instructions updated to reinforce the codebase_search-first approach when available.

4. **User Custom Instructions**: The user's global instruction "Always use codebase_search before any other search first" provides an additional layer of enforcement.

## Benefits

1. **Better Context Understanding**: By using semantic search first, the AI can find functionally relevant code even without knowing exact keywords or file names.

2. **Efficiency**: Reduces the need for multiple regex searches or file explorations by finding the most relevant code upfront.

3. **Consistency**: Ensures a standardized approach to understanding codebase context across all modes and tasks.

4. **Graceful Degradation**: The system only mentions codebase_search when it's actually available, preventing confusion when the feature is disabled.

## Testing

Test files have been created to verify the implementation:
- `src/core/prompts/sections/__tests__/tool-use-guidelines.test.ts`
- `src/core/prompts/sections/__tests__/objective.test.ts`

These tests verify both scenarios:
- When codebase_search is available (enforcement is included)
- When codebase_search is not available (enforcement is excluded)

## Future Considerations

1. The enforcement only applies when the `codebase_search` tool is available (i.e., when the code index feature is enabled, configured, and initialized).

2. The system gracefully falls back to other search methods if `codebase_search` is not available, without mentioning it in the prompts.

3. The enforcement is designed to guide behavior without being overly restrictive - it emphasizes "MUST" for new tasks and understanding existing code, but allows flexibility for other scenarios.