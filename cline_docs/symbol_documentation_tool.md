# Symbol Documentation Tool Implementation Plan

## Overview
This document outlines the implementation plan for adding a new `get_symbol_documentation` tool to Roo's capabilities. This tool will retrieve documentation, type information, and other hover details for symbols in the codebase, with the option to scope the lookup to a specific file.

## 1. Architecture Changes Required

### Core Tool Definition
First, we need to add the tool definition in `src/core/assistant-message/index.ts`:

```typescript
// Add to toolUseNames array
export const toolUseNames = [
  // existing tools...
  "get_symbol_documentation",
] as const

// Add new parameters to toolParamNames array (if not already present)
export const toolParamNames = [
  // existing params...
  "symbol_name",
  "file_path",   // Optional parameter for file-scoped lookups
] as const

// Add new interface
export interface GetSymbolDocumentationToolUse extends ToolUse {
  name: "get_symbol_documentation"
  params: Partial<Pick<Record<ToolParamName, string>, "symbol_name" | "file_path">>
}
```

### Implementation in Cline Class
Next, we need to implement the tool in `src/core/Cline.ts`:

1. Add helper methods for symbol documentation in the `Cline` class
2. Add a case in the large switch statement in `presentAssistantMessage()` method

### System Prompt Update
We need to update the system prompt in `src/core/prompts/system.ts` to describe the new tool to the LLM.

## 2. Data Flow & Implementation Details

### Workflow
1. The LLM calls the `get_symbol_documentation` tool with a symbol name and optional file path
2. If a file path is provided, we find usage of the symbol in that file:
   - For symbols defined in the file, we use document symbol provider
   - For imported/referenced symbols, we search for usage and use hover at that position
3. If no file path is provided or symbol not found in file, we use workspace symbol provider
4. We then use VS Code's language services to get hover info at the symbol location
5. We return formatted documentation to the LLM

### Core Implementation Details

#### VS Code Language Services
There are three key VS Code language service methods we'll use:
1. `vscode.executeDocumentSymbolProvider` - Gets symbols defined in a specific file
2. `vscode.executeWorkspaceSymbolProvider` - Gets symbols defined anywhere in the workspace
3. `vscode.executeHoverProvider` - Gets hover info (documentation) at a specific position
4. `vscode.executeDefinitionProvider` - Gets the definition location of a symbol

#### Handling Imported Symbols
Based on the feedback, document symbols only include symbols defined in that file, not imported ones. To properly handle imported symbols:

1. If a symbol isn't found in the document symbols, we need to:
   - Search for usages of the symbol name in the file (text search)
   - Call the hover provider at those usage positions to get documentation
   - Or call definition provider at the usage site, then hover at the definition location

2. This approach will work for:
   - Locally defined symbols
   - Symbols imported from the workspace
   - Symbols imported from third-party libraries (if the language server has resolved them)

## 3. Revised Implementation Plan

### Symbol Search and Documentation Helper Functions

```typescript
// Helper to find all occurrences of a symbol in text
async function findSymbolOccurrences(symbolName: string, document: vscode.TextDocument): Promise<vscode.Position[]> {
  const text = document.getText();
  const positions: vscode.Position[] = [];
  
  // Simple regex to find word boundaries - could be enhanced for more precision
  const regex = new RegExp(`\\b${symbolName}\\b`, 'g');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const pos = document.positionAt(match.index);
    positions.push(pos);
  }
  
  return positions;
}

// Check if a position is within an import statement
function isImportStatement(document: vscode.TextDocument, position: vscode.Position): boolean {
  const lineText = document.lineAt(position.line).text;
  return /^\s*(import|from|require|use|include|using)/.test(lineText);
}

// Get documentation for a symbol at a specific position
async function getHoverAtPosition(uri: vscode.Uri, position: vscode.Position): Promise<string | null> {
  try {
    const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      uri,
      position
    );
    
    if (!hoverResults || hoverResults.length === 0) {
      return null;
    }
    
    // Extract the text from hover results
    let hoverText = '';
    for (const content of hoverResults[0].contents) {
      if (typeof content === 'string') {
        hoverText += content + '\n';
      } else {
        // content is a MarkdownString
        hoverText += content.value + '\n';
      }
    }
    
    return hoverText.trim();
  } catch (error) {
    console.error(`Error getting hover information: ${error}`);
    return null;
  }
}

// Find a symbol in the document (defined or imported)
async function findSymbolInDocument(symbolName: string, filePath: string): Promise<{
  symbolInfo?: vscode.SymbolInformation,
  hoverText?: string,
  isImported: boolean,
  location?: vscode.Location
} | null> {
  try {
    const uri = vscode.Uri.file(path.resolve(cwd, filePath));
    const document = await vscode.workspace.openTextDocument(uri);
    
    // STEP 1: Check if symbol is defined in the document
    const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );
    
    if (documentSymbols && documentSymbols.length > 0) {
      // Helper function to search recursively through DocumentSymbol hierarchy
      function findSymbol(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol | null {
        for (const symbol of symbols) {
          if (symbol.name === symbolName) {
            return symbol;
          }
          if (symbol.children && symbol.children.length > 0) {
            const found = findSymbol(symbol.children);
            if (found) return found;
          }
        }
        return null;
      }
      
      const foundSymbol = findSymbol(documentSymbols);
      if (foundSymbol) {
        // Symbol is defined in the document
        const symbolInfo = {
          name: foundSymbol.name,
          kind: foundSymbol.kind,
          location: new vscode.Location(uri, foundSymbol.range),
          containerName: ''
        };
        
        const hoverText = await getHoverAtPosition(uri, foundSymbol.selectionRange.start);
        
        return {
          symbolInfo,
          hoverText: hoverText || undefined,
          isImported: false,
          location: symbolInfo.location
        };
      }
    }
    
    // STEP 2: Check for imports or references if not defined in the document
    const occurrences = await findSymbolOccurrences(symbolName, document);
    if (occurrences.length === 0) {
      return null; // Symbol not found in document
    }
    
    // Try to find non-import usages first
    const nonImportOccurrences = occurrences.filter(pos => !isImportStatement(document, pos));
    const usagePositions = nonImportOccurrences.length > 0 ? nonImportOccurrences : occurrences;
    
    // STEP 3: For each occurrence, try to get hover information and definition
    for (const position of usagePositions) {
      // Try hover directly at usage site
      const hoverText = await getHoverAtPosition(uri, position);
      
      // Try to get definition
      const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeDefinitionProvider',
        uri,
        position
      );
      
      if (definitions && definitions.length > 0) {
        const definition = definitions[0];
        
        // If hover text at usage site doesn't work, try at definition site
        let finalHoverText = hoverText;
        if (!finalHoverText) {
          finalHoverText = await getHoverAtPosition(definition.uri, definition.range.start);
        }
        
        if (finalHoverText) {
          return {
            hoverText: finalHoverText,
            isImported: true,
            location: definition
          };
        }
      } else if (hoverText) {
        // We have hover text but no definition (common for some built-ins)
        return {
          hoverText,
          isImported: true,
          location: new vscode.Location(uri, position)
        };
      }
    }
    
    // If we get here, we found the symbol but couldn't get hover info
    return {
      isImported: true,
      location: new vscode.Location(uri, usagePositions[0])
    };
    
  } catch (error) {
    console.error(`Error searching for symbol in document: ${error}`);
    return null;
  }
}

// Workspace-wide symbol search
async function findSymbolInWorkspace(symbolName: string): Promise<{
  symbolInfo: vscode.SymbolInformation,
  hoverText?: string
} | null> {
  try {
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      symbolName
    );
    
    if (!symbols || symbols.length === 0) {
      return null;
    }
    
    // Return the first match
    const symbolInfo = symbols[0];
    const hoverText = await getHoverAtPosition(
      symbolInfo.location.uri, 
      symbolInfo.location.range.start
    );
    
    return {
      symbolInfo,
      hoverText: hoverText || undefined
    };
  } catch (error) {
    console.error(`Error searching for symbol in workspace: ${error}`);
    return null;
  }
}
```

### Get Symbol Documentation Implementation
This would be added to the Cline class:

```typescript
async getSymbolDocumentation(symbolName: string, filePath?: string): Promise<string> {
  try {
    // STEP 1: If file path is provided, try to find the symbol in that file first
    if (filePath) {
      const documentResult = await this.findSymbolInDocument(symbolName, filePath);
      
      if (documentResult) {
        const { symbolInfo, hoverText, isImported, location } = documentResult;
        
        // Format location information
        const locationDesc = location 
          ? `${location.uri.fsPath}:${location.range.start.line + 1}:${location.range.start.character + 1}`
          : '(Location not available)';
        
        // Format kind information
        let kindDesc = 'Unknown';
        if (symbolInfo) {
          kindDesc = vscode.SymbolKind[symbolInfo.kind];
        }
        
        // Format container information
        let containerDesc = 'Global Scope';
        if (symbolInfo && symbolInfo.containerName) {
          containerDesc = symbolInfo.containerName;
        }
        
        // If we have hover text, return it with location info
        if (hoverText) {
          return `Symbol: ${symbolName}
Location: ${locationDesc}
${symbolInfo ? `Kind: ${kindDesc}` : ''}
${symbolInfo ? `Container: ${containerDesc}` : ''}
${isImported ? 'Status: Imported/Referenced' : 'Status: Defined in file'}
Referenced in: ${filePath}

Documentation:
${hoverText}`;
        } else {
          // We found the symbol but couldn't get documentation
          return `Symbol: ${symbolName} found at ${locationDesc}
${isImported ? 'Status: Imported/Referenced' : 'Status: Defined in file'}
Referenced in: ${filePath}

No documentation is available for this symbol.`;
        }
      }
    }
    
    // STEP 2: Fall back to workspace search if not found in the specified file or no file specified
    const workspaceResult = await this.findSymbolInWorkspace(symbolName);
    
    if (workspaceResult) {
      const { symbolInfo, hoverText } = workspaceResult;
      
      // Format location
      const locationDesc = `${symbolInfo.location.uri.fsPath}:${symbolInfo.location.range.start.line + 1}:${symbolInfo.location.range.start.character + 1}`;
      
      if (hoverText) {
        return `Symbol: ${symbolName}
Location: ${locationDesc}
Kind: ${vscode.SymbolKind[symbolInfo.kind]}
Container: ${symbolInfo.containerName || 'Global Scope'}
${filePath ? `Not directly referenced in: ${filePath}` : ''}

Documentation:
${hoverText}`;
      } else {
        return `Symbol: ${symbolName} found at ${locationDesc}
Kind: ${vscode.SymbolKind[symbolInfo.kind]}
Container: ${symbolInfo.containerName || 'Global Scope'}
${filePath ? `Not directly referenced in: ${filePath}` : ''}

No documentation is available for this symbol.`;
      }
    }
    
    // STEP 3: No results found
    return `No symbol found for '${symbolName}'${filePath ? ` in or referenced by file '${filePath}'` : ''}.`;
    
  } catch (error) {
    return `Error retrieving documentation for symbol '${symbolName}': ${error.message}`;
  }
}
```

### Tool Handler in presentAssistantMessage()
```typescript
case "get_symbol_documentation": {
  const symbolName: string | undefined = block.params.symbol_name;
  const filePath: string | undefined = block.params.file_path;
  
  try {
    if (block.partial) {
      const partialMessage = JSON.stringify({
        tool: "getSymbolDocumentation",
        symbolName: removeClosingTag("symbol_name", symbolName),
        filePath: removeClosingTag("file_path", filePath),
      });
      await this.ask("tool", partialMessage, block.partial).catch(() => {});
      break;
    } else {
      if (!symbolName) {
        this.consecutiveMistakeCount++;
        pushToolResult(await this.sayAndCreateMissingParamError("get_symbol_documentation", "symbol_name"));
        break;
      }
      
      this.consecutiveMistakeCount = 0;
      
      // Show tool is being used
      const completeMessage = JSON.stringify({
        tool: "getSymbolDocumentation",
        symbolName,
        filePath,
      });
      const didApprove = await askApproval("tool", completeMessage);
      if (!didApprove) {
        break;
      }
      
      // Implement the actual symbol lookup
      const result = await this.getSymbolDocumentation(symbolName, filePath);
      pushToolResult(result);
      break;
    }
  } catch (error) {
    await handleError("getting symbol documentation", error);
    break;
  }
}
```

### System Prompt Addition
```
## get_symbol_documentation
Description: Request to retrieve documentation, type information, and other hover details for a symbol in the codebase.
Parameters:
- symbol_name: (required) The name of the symbol to look up (function, class, method, etc.)
- file_path: (optional) Path to a file where the symbol is used/referenced, to scope the search and avoid conflicts with similarly named symbols

Usage:
<get_symbol_documentation>
<symbol_name>MyClass</symbol_name>
<file_path>src/models/user.ts</file_path>
</get_symbol_documentation>

Example: Requesting documentation for a class named "User" that is referenced in a specific file
<get_symbol_documentation>
<symbol_name>User</symbol_name>
<file_path>src/controllers/auth.ts</file_path>
</get_symbol_documentation>
```

## 4. Key Improvements for Handling Imported Symbols

This revised implementation addresses several important considerations:

1. **For directly defined symbols** (in the specified file):
   - Uses `vscode.executeDocumentSymbolProvider` to find them
   - Gets hover information directly at the symbol definition

2. **For imported/referenced symbols** (not defined in the file):
   - Searches for occurrences of the symbol name in the file text
   - For each occurrence:
     - Uses `vscode.executeHoverProvider` directly at the usage site
     - Uses `vscode.executeDefinitionProvider` to find the symbol definition
     - Falls back to getting hover at the definition location if needed

3. **Classification of results**:
   - Includes whether the symbol is defined in the file or imported/referenced
   - Shows both the usage location and definition location when appropriate

This approach directly addresses the feedback that imported symbols won't be included in document symbols but can still be accessed via hover or definition providers.

## 5. Testing Strategy

Unit tests should be added to verify:
1. Symbol lookups work correctly for both document-scoped and workspace-wide searches
2. Documentation retrieval works across different language types
3. Error handling works correctly for missing symbols or files
4. Both locally defined symbols and imported symbols are correctly documented

Integration tests would verify the tool works end-to-end as expected.

## 6. Edge Cases and Error Handling

1. Symbol not found in workspace
2. Symbol found but no documentation available
3. File path provided but doesn't exist
4. File path provided but symbol not referenced/used in that file
5. Multiple symbols with the same name in different scopes
6. Language server not available for the file type
7. Symbol is reference-only (e.g., in a comment) with no definition
8. False positives when searching for symbol occurrences in text

## 7. Performance Considerations

1. Document symbols and hover providers are provided by language servers which may have varying performance characteristics
2. For large files, text search for occurrences could be slow
3. Multiple hover provider calls could be expensive in large files with many occurrences
4. Consider caching recent lookups if the tool is used frequently

## 8. Implementation Phases

1. **Phase 1**: Basic implementation with workspace symbol provider
2. **Phase 2**: Add file scoping with document symbol provider for defined symbols
3. **Phase 3**: Enhance with text search + hover/definition providers for imported symbols
4. **Phase 4**: Add caching for performance and better handling of duplicates

## Conclusion

This improved implementation allows Roo to look up symbol documentation with optional file scoping, properly handling both locally defined symbols and imported/referenced symbols. The approach integrates well with VS Code's existing language services and follows the pattern of other tools in the codebase. By using hover providers at usage sites and definition locations, we can retrieve documentation even for symbols imported from external libraries.