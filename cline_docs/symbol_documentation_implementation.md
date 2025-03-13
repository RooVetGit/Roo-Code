# Symbol Documentation Tool Implementation

## Overview

The Symbol Documentation Tool is a feature added to Roo Code that enables retrieving documentation, type information, and hover details for symbols in the codebase. This document details the implementation of this feature, which extends Roo's capabilities to provide better code understanding and navigation.

## Architecture

The implementation follows a standard pattern for Roo tools, with changes made to the following components:

1. **Tool Definition**

    - Added to toolUseNames and toolParamNames arrays in `src/core/assistant-message/index.ts`
    - Created a GetSymbolDocumentationToolUse interface

2. **Tool Prompt**

    - Added tool description in `src/core/prompts/tools/get-symbol-documentation.ts`
    - Registered in `src/core/prompts/tools/index.ts`

3. **Tool Group Assignment**

    - Added to the "read" tool group in `src/shared/tool-groups.ts`
    - Added display name "look up symbols"

4. **Core Implementation**
    - Implemented in `src/core/Cline.ts` with the `getSymbolDocumentation` method

## Implementation Details

### Parameters

The tool accepts two parameters:

- `symbol_name` (required): The name of the symbol to look up (function, class, method, etc.)
- `path` (optional): Path to a file where the symbol is used/referenced, to scope the search

### Search Strategy

The implementation follows a multi-stage approach to find symbols and their documentation:

1. **File-Scoped Search** (when path is provided):

    - First tries to find the symbol defined in the document using `vscode.executeDocumentSymbolProvider`
    - If not found as a defined symbol, searches for occurrences of the symbol name in the file text
    - For each occurrence, attempts to retrieve hover information directly or at the definition site

2. **Workspace-Wide Search** (fallback or when no path provided):

    - Uses `vscode.executeWorkspaceSymbolProvider` to find symbols across the workspace
    - Retrieves hover information at the symbol's location

3. **Documentation Extraction**:
    - Uses `vscode.executeHoverProvider` to get hover information (documentation, type info)
    - Processes hover results from VS Code's language servers and formats them for display

### VS Code Language Services Used

The implementation leverages several VS Code API services:

1. **Document Symbol Provider**:

    - Gets symbols defined within a specific file
    - Recursive search through the symbol hierarchy

2. **Workspace Symbol Provider**:

    - Gets symbols defined anywhere in the workspace
    - Useful for finding global definitions

3. **Hover Provider**:

    - Gets documentation, type information, and other details for a symbol
    - Works at both usage sites and definition sites

4. **Definition Provider**:
    - Gets the location where a symbol is defined
    - Used to jump from a usage site to the definition for better documentation

### Symbol Type Handling

The implementation handles different types of symbols:

1. **Locally Defined Symbols**:

    - Found directly in the document symbol hierarchy
    - Documentation retrieved at the definition site

2. **Imported/Referenced Symbols**:

    - Located by searching for occurrences in the file text
    - Documentation may be retrieved at the usage site or by following the definition

3. **Workspace Symbols**:
    - Global definitions found across the workspace
    - Used as a fallback when file-scoped search fails

### Output Format

The tool returns a formatted string with the following information:

```
Symbol: [name]
Location: [file path]:[line]:[column]
Kind: [symbol kind]
Status: [Defined in file/Imported/Referenced]
[Container information if available]
[Referenced in information if relevant]

Documentation:
[Hover text from language server]
```

## Error Handling

The implementation handles several error cases:

1. Symbol not found in specified file
2. Symbol not found in workspace
3. File not found or can't be opened
4. Documentation not available for a symbol
5. Language server errors

## Example Usage

```
<get_symbol_documentation>
<symbol_name>User</symbol_name>
<path>src/controllers/auth.ts</path>
</get_symbol_documentation>
```

This would look for the `User` symbol in the `auth.ts` file, retrieve its documentation, and return the formatted result to the LLM.

## Performance Considerations

The implementation is designed to be efficient by:

1. First searching within a specific file when provided
2. Using VS Code's optimized providers that leverage language servers
3. Finding one match and retrieving its documentation rather than searching exhaustively
4. Taking advantage of contextual information (file path) when available

## Integration with Existing Capabilities

This tool complements Roo's existing code navigation and understanding tools:

- `read_file`: Gets full file content
- `list_code_definition_names`: Lists top-level definitions in files
- `search_files`: Finds patterns across files

The Symbol Documentation Tool provides deeper, more specific information about individual symbols, making it valuable for understanding API details, type information, and documentation without having to read through entire files.
