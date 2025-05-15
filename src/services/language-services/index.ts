import * as vscode from "vscode"

// Create a dedicated output channel for debugging C# references
const debugChannel = vscode.window.createOutputChannel("C# References Debug - Language Services");

/**
 * Log a debug message to the output channel
 * @param message The message to log
 */
function debugLog(message: string): void {
  const timestamp = new Date().toISOString();
  debugChannel.appendLine(`[${timestamp}] [LanguageServices] ${message}`);
  // Also log to console for terminal visibility
  console.log(`[C# References Debug] [LanguageServices] ${message}`);
}

/**
 * Check if language services are available for a file
 * @param document The document to check
 * @returns True if language services are available
 */
export async function hasLanguageServices(document: vscode.TextDocument): Promise<boolean> {
  debugLog(`Checking language services for ${document.uri.fsPath} (language: ${document.languageId})`)
  try {
    // Try to get document symbols as a test for language services
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    )
    const hasServices = symbols !== undefined && symbols.length > 0
    debugLog(`Language services ${hasServices ? 'available' : 'not available'} for ${document.uri.fsPath}`)
    if (hasServices && symbols) {
      debugLog(`Found ${symbols.length} top-level symbols`)
    }
    return hasServices
  } catch (error) {
    debugLog(`ERROR checking language services: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

/**
 * Find the position of a symbol in a document
 * @param document The document to search
 * @param symbolName The name of the symbol to find
 * @param position Optional position to start searching from
 * @returns The position of the symbol or undefined if not found
 */
export async function findSymbolPosition(
  document: vscode.TextDocument,
  symbolName: string,
  position?: vscode.Position
): Promise<vscode.Position | undefined> {
  debugLog(`Finding position for symbol '${symbolName}' in ${document.uri.fsPath}`)
  debugLog(`Document language: ${document.languageId}`)
  
  // If position is provided, use it
  if (position) {
    debugLog(`Using provided position: line ${position.line}, character ${position.character}`)
    return position
  }

  // Try to find the symbol in the document
  try {
    debugLog(`Executing document symbol provider for ${document.uri.fsPath}`)
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    )

    if (!symbols || symbols.length === 0) {
      debugLog(`No symbols found in ${document.uri.fsPath}`)
      debugLog(`Falling back to text search for '${symbolName}'`)
      
      // Fallback: Try to find the symbol in the text
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text
        const index = line.indexOf(symbolName)
        if (index >= 0) {
          const pos = new vscode.Position(i, index)
          debugLog(`Found symbol '${symbolName}' via text search at line ${i}, character ${index}`)
          return pos
        }
      }
      
      debugLog(`Symbol '${symbolName}' not found via text search either`)
      return undefined
    }

    // Recursively search for the symbol
    const findSymbol = (symbols: vscode.DocumentSymbol[]): vscode.Position | undefined => {
      for (const symbol of symbols) {
        // Match only by exact name
        if (symbol.name === symbolName) {
          debugLog(`Found exact matching symbol: ${symbol.name} at line ${symbol.range.start.line}, character ${symbol.range.start.character}`)
          
          // Use selectionRange instead of range for more precise positioning
          // selectionRange typically points to just the name of the symbol
          debugLog(`Using selectionRange: line ${symbol.selectionRange.start.line}, character ${symbol.selectionRange.start.character}`)
          return symbol.selectionRange.start
        }

        if (symbol.children.length > 0) {
          const childResult = findSymbol(symbol.children)
          if (childResult) {
            return childResult
          }
        }
      }
      return undefined
    }

    const position = findSymbol(symbols)
    
    if (position) {
      debugLog(`Found symbol position at line ${position.line}, character ${position.character}`)
      
      // Log detailed information about the found symbol
      try {
        // Find the actual symbol in the document symbols
        const findSymbolDetails = (symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined => {
          for (const symbol of symbols) {
            if (symbol.name === symbolName) {
              return symbol;
            }
            if (symbol.children.length > 0) {
              const childResult = findSymbolDetails(symbol.children);
              if (childResult) {
                return childResult;
              }
            }
          }
          return undefined;
        };
        
        const symbolDetails = findSymbolDetails(symbols);
        
        if (symbolDetails) {
          debugLog(`SYMBOL DETAILS:`);
          debugLog(`  Name: ${symbolDetails.name}`);
          debugLog(`  Kind: ${vscode.SymbolKind[symbolDetails.kind]}`);
          debugLog(`  Range: lines ${symbolDetails.range.start.line}-${symbolDetails.range.end.line}, chars ${symbolDetails.range.start.character}-${symbolDetails.range.end.character}`);
          debugLog(`  Selection Range: lines ${symbolDetails.selectionRange.start.line}-${symbolDetails.selectionRange.end.line}, chars ${symbolDetails.selectionRange.start.character}-${symbolDetails.selectionRange.end.character}`);
          
          // Log the full text of the symbol if it spans multiple lines
          if (symbolDetails.range.start.line !== symbolDetails.range.end.line) {
            debugLog(`  Multi-line symbol content:`);
            for (let i = symbolDetails.range.start.line; i <= symbolDetails.range.end.line; i++) {
              debugLog(`    ${i}: ${document.lineAt(i).text}`);
            }
          } else {
            const lineText = document.lineAt(symbolDetails.range.start.line).text;
            debugLog(`  Symbol content: "${lineText.substring(symbolDetails.range.start.character, symbolDetails.range.end.character)}"`);
          }
        }
      } catch (e) {
        debugLog(`Error getting symbol details: ${e}`);
      }
    } else {
      debugLog(`Symbol '${symbolName}' not found in document symbols`)
    }
    
    // Show the output channel to make sure logs are visible
    debugChannel.show(true);
    
    return position
  } catch (error) {
    debugLog(`ERROR finding symbol position: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      debugLog(`Stack trace: ${error.stack}`)
    }
    // Show the output channel on error to make sure logs are visible
    debugChannel.show(true);
    return undefined
  }
}

/**
 * Get the containing function for a position in a document
 * @param document The document to search
 * @param position The position to find the containing function for
 * @returns The function symbol or undefined if not found
 */
export async function getContainingFunction(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.DocumentSymbol | undefined> {
  try {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    )

    if (!symbols || symbols.length === 0) {
      return undefined
    }

    // Recursively search for a function that contains the position
    const findContainingFunction = (symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined => {
      for (const symbol of symbols) {
        // Check if this symbol contains the position and is a function/method
        if (
          symbol.range.contains(position) &&
          (symbol.kind === vscode.SymbolKind.Function ||
           symbol.kind === vscode.SymbolKind.Method ||
           symbol.kind === vscode.SymbolKind.Constructor)
        ) {
          // Create a modified symbol with the selectionRange as the range
          // This focuses on the function name rather than the entire function block
          const adjustedSymbol = {
            ...symbol,
            range: symbol.selectionRange
          };
          return adjustedSymbol;
        }

        // Check children
        if (symbol.children.length > 0) {
          const childResult = findContainingFunction(symbol.children)
          if (childResult) {
            return childResult
          }
        }
      }
      return undefined
    }

    const functionSymbol = findContainingFunction(symbols)
    return functionSymbol
  } catch (error) {
    return undefined
  }
}

/**
 * Find a function by name in a document
 * @param document The document to search
 * @param functionName The name of the function to find
 * @returns The function symbol or undefined if not found
 */
export async function findFunctionsByName(
  document: vscode.TextDocument,
  functionName: string
): Promise<vscode.DocumentSymbol[] | undefined> {
  debugLog(`Finding function '${functionName}' in ${document.uri.fsPath}`)
  
  try {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    )

    if (!symbols || symbols.length === 0) {
      return undefined
    }

    // Recursively search for all matching functions (to handle overloads)
    const matchingFunctions: vscode.DocumentSymbol[] = []
    
    const findFunctions = (symbols: vscode.DocumentSymbol[]): void => {
      for (const symbol of symbols) {
        // Match only by exact name
        const isMatch = symbol.name === functionName
                        
        if (
          isMatch &&
          (symbol.kind === vscode.SymbolKind.Function ||
           symbol.kind === vscode.SymbolKind.Method ||
           symbol.kind === vscode.SymbolKind.Constructor)
        ) {
          matchingFunctions.push(symbol)
        }

        // Continue searching in children even if we found a match
        if (symbol.children.length > 0) {
          findFunctions(symbol.children)
        }
      }
    }

    findFunctions(symbols)
    
    // Log the number of matching functions found
    if (matchingFunctions.length > 0) {
      debugLog(`Found ${matchingFunctions.length} matching function(s) named '${functionName}'`)
      
      // Log details of each matching function
      matchingFunctions.forEach((func, index) => {
        debugLog(`Match #${index + 1}: line ${func.range.start.line}, character ${func.range.start.character}`)
      })
      
      return matchingFunctions
    }
    
    return undefined
  } catch (error) {
    return undefined
  }
}