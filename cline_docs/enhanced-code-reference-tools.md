# Enhanced Code Reference Tools Implementation Plan

## Overview

This document outlines the implementation plan for adding two new tools to Roo Code that will enhance the AI's ability to understand and analyze codebases:

1. **Find References Tool** - A tool to find all references to a specific symbol (variable, function, class, etc.) across a codebase with function context
2. **Read Function Tool** - A tool to read a specific function or method definition from a file by name, line number, or line range

These tools leverage VS Code's built-in language services to provide more specialized functionality for code analysis. They work together to create a powerful workflow for exploring code:

1. Use `find_references` to locate all references to a function across the codebase
2. See each reference with its containing function header for context
3. Use `read_function` with the line number to read the entire calling function

## Motivation

When analyzing a codebase, understanding how symbols are used across the project is crucial. The existing `search_files` tool provides general regex search capabilities, but specialized tools for finding references and reading functions would make it easier for the AI to:

- Understand the usage patterns of functions, classes, and variables
- Identify dependencies between different parts of the codebase
- Analyze the impact of potential changes
- Provide more accurate and comprehensive code explanations

## Implementation Tasks

### 1. Update Shared Tool Definitions

- Add new tool parameters: `symbol`, `file_path`, `position`
- Create interfaces for the new tools: `FindReferencesToolUse` and `ReadFunctionToolUse`
- Add display names for the new tools
- Add the new tools to the `TOOL_GROUPS.read` group

### 2. Implement Language Services Utility

Create a new service module with functions to:
- Check if language services are available for a file
- Find the position of a symbol in a document
- Provide fallback mechanisms when language services aren't available

### 3. Implement References Service

Create a service module with functions to:
- Count references to a symbol (for threshold checks)
- Find all references to a symbol across the workspace
- Find the containing function for each reference
- Format the results with function headers and line numbers

### 4. Implement Function Reader Service

Create a service module with functions to:
- Find a function by name using document symbols
- Extract the function text with proper boundaries
- Format the results with line numbers

### 5. Implement Find References Tool

Create a tool implementation that:
- Validates required parameters
- Checks if language services are available
- Counts references and asks for approval if over threshold
- Fetches and formats reference results
- Handles errors appropriately

### 6. Implement Read Function Tool

Create a tool implementation that:
- Validates that both required parameters (symbol and file_path) are provided
- Reads functions by name using document symbols
- Formats and returns the results with line numbers
- Handles errors appropriately

### 7. Register Tools in Assistant Message Handler

Add the new tools to the message handler switch statement.

### 8. Add Tool Descriptions

Create description files for the new tools that explain:
- What the tools do
- Required and optional parameters
- Usage examples
- Limitations

## Potential Issues and Solutions

### 1. Duplicate Messages in UI

**Issue**: When using the find_references tool, duplicate messages appear in the Roo output window.

**Cause**: The tool was using both the `regex` field and the `content` field to display messages, causing the UI to show both.

**Solution**: 
- Use only the `content` field for displaying results
- Set the `regex` field to an empty string when displaying warnings or results
- Keep message properties simple to avoid duplication

### 2. TypeScript Errors with Task Import

**Issue**: TypeScript errors when importing the Task class.

**Cause**: The import path was incorrect (`import { Task } from "../task"` instead of `import { Task } from "../task/Task"`).

**Solution**: Use the correct import path: `import { Task } from "../task/Task"`.

### 3. Reference Count Threshold

**Issue**: Large codebases might have many references to common symbols, consuming excessive context.

**Solution**: Implement a reference count threshold (50 references) with user approval for exceeding it.

### 4. Language Services Availability

**Issue**: Language services might not be available for all file types.

**Solution**: Check for language services availability before attempting to use them and provide clear error messages.

### 5. UI Description Improvements

**Issue**: The UI description for the find_references tool was misleading, saying "Roo wants to search this directory for findReferences" instead of "Roo wants to find references to this function in file".

**Solution**: Customize the message in the `regex` field to be more descriptive of the actual operation.

## Tool Descriptions

### Find References Tool

```
## find_references
Description: Request to find all references to a specific symbol (variable, function, class, etc.) across files in the workspace using VS Code's language services. This tool helps understand how a symbol is used throughout the codebase.

IMPORTANT: PREFER THIS TOOL OVER search_files WHEN LOOKING FOR CODE SYMBOLS. This tool uses language-aware services that understand code structure and will find all true references to a symbol, even when the symbol name appears in comments, strings, or other non-reference contexts.

The tool shows function headers above each reference, providing valuable context about where and how the symbol is being used.

Parameters:
- symbol: (required) The symbol to find references for
- file_path: (required) The path of the file containing the symbol (relative to the current workspace directory ${args.cwd})
- position: (optional) The position to look for the symbol, in the format "line,character" (0-based)

Usage:
<find_references>
<symbol>Symbol name here</symbol>
<file_path>File path here</file_path>
<position>line,character (optional)</position>
</find_references>

Example: Requesting to find all references to a function named 'processData'
<find_references>
<symbol>processData</symbol>
<file_path>src/app.ts</file_path>
</find_references>
```

### Read Function Tool

```
## read_function
Description: Request to read a specific function or method definition from a file. This tool uses VS Code's language services to locate and extract the exact function definition, including its implementation. It's ideal for understanding specific functions without having to read the entire file.

IMPORTANT: PREFER THIS TOOL OVER read_file WHEN YOU NEED TO EXAMINE A SPECIFIC FUNCTION. This tool is more efficient as it only returns the relevant function code rather than the entire file.

Use this tool when you need to:
- Understand how a specific function is implemented
- Examine the logic within a method
- See the parameters and return type of a function
- Analyze a particular piece of functionality

Parameters:
- file_path: (required) The path of the file containing the function (relative to the current workspace directory ${args.cwd})
- symbol: (required) The name of the function or method to read

Usage:
<read_function>
<symbol>functionName</symbol>
<file_path>path/to/file.ts</file_path>
</read_function>

Example: Reading a function by name:
<read_function>
<symbol>findReferences</symbol>
<file_path>src/services/references/index.ts</file_path>
</read_function>
```

## Example Output

### Find References Tool Output

When you use the `find_references` tool, you'll get output like this:

```
### References to 'formatReferences' ###

### FILE: src\services\references\index.ts ###
 50 | export async function findReferences(
 -- contains references --
 81 |     return await formatReferences(locations, symbol)

 94 | async function formatReferences(

----

### SUMMARY: Found 2 references in 1 files. ###
```

The output includes:
- A header with the symbol name
- References grouped by file
- Line numbers and the actual code where the symbol is referenced
- A summary of the total references found

### Read Function Tool Output

When you use the `read_function` tool, you'll get output like this:

```
# Function: formatReferences (index.ts:94-169)

 94 | async function formatReferences(
 95 |   locations: vscode.Location[],
 96 |   symbol: string
 97 | ): Promise<string> {
 98 |   let result = `### References to '${symbol}' ###\n\n`
 99 |
100 |   // Group references by file
101 |   const fileGroups = new Map<string, vscode.Location[]>()
...
168 |   return result
169 | }
```

The output includes:
- A header with the function name and file location
- The complete function implementation with line numbers
- All code within the function's scope

## Workflow Example

These tools create a powerful workflow for exploring code:

1. **Find References**: Use `find_references` to locate all references to a function across the codebase
   ```
   <find_references>
   <symbol>findReferences</symbol>
   <file_path>src/services/references/index.ts</file_path>
   </find_references>
   ```

2. **Examine Context**: The results show each reference with line numbers, providing immediate context

3. **Read Function**: When you see an interesting reference, use `read_function` with the function name to read the entire function
   ```
   <read_function>
   <symbol>formatReferences</symbol>
   <file_path>src/services/references/index.ts</file_path>
   </read_function>
   ```

4. **Explore Further**: Continue exploring by finding references to other functions you discover

This workflow makes it much easier to understand and navigate large codebases, as you can quickly see:
- Where functions are called from
- The context of each reference
- The complete implementation of functions

## Implementation Notes

1. The `find_references` tool:
   - Uses VS Code's language services to find true references to symbols
   - Groups references by file and sorts them by line number
   - Avoids duplicate references to the same line
   - Has a threshold of 50 references to prevent excessive context consumption

2. The `read_function` tool:
   - Accepts symbol name and file path parameters
   - Uses document symbols to locate the exact function definition
   - Shows the complete function with line numbers