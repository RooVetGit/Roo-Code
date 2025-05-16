import * as vscode from "vscode"
import * as path from "path"
import { getContainingFunction, findSymbolPosition, getContainingSymbol } from "../language-services"

// Create a dedicated output channel for debugging C# references
const debugChannel = vscode.window.createOutputChannel("C# References Debug");

/**
 * Log a debug message to the output channel
 * @param message The message to log
 */
function debugLog(message: string): void {
  const timestamp = new Date().toISOString();
  debugChannel.appendLine(`[${timestamp}] ${message}`);
  // Also log to console for terminal visibility
  console.log(`[C# References Debug] ${message}`);
}

// Maximum number of references to return without asking for approval
const MAX_REFERENCES_THRESHOLD = 50

/**
 * Count the number of references to a symbol
 * @param document The document containing the symbol
 * @param symbolName The name of the symbol to find references for
 * @param position Optional position of the symbol
 * @returns The number of references
 */
export async function countReferences(
  document: vscode.TextDocument,
  symbolName: string,
  lineNumber?: number
): Promise<number> {
  debugLog(`Starting search for '${symbolName}' in ${document.uri.fsPath}`)
  debugLog(`Document language: ${document.languageId}`)
  
  // If line number is provided, create a position at that line
  let symbolPosition: vscode.Position | undefined
  if (lineNumber !== undefined) {
    // Find the position of the symbol on the specified line
    const line = document.lineAt(lineNumber).text
    const charPos = line.indexOf(symbolName)
    if (charPos >= 0) {
      symbolPosition = new vscode.Position(lineNumber, charPos)
      debugLog(`Using provided line number ${lineNumber}, found symbol at character ${charPos}`)
    } else {
      debugLog(`Symbol '${symbolName}' not found on line ${lineNumber}`)
    }
  }
  
  // If we don't have a position yet, try to find it
  symbolPosition = symbolPosition || await findSymbolPosition(document, symbolName)
  
  if (!symbolPosition) {
    debugLog(`Symbol position not found for '${symbolName}' in ${document.uri.fsPath}`)
    return 0
  }

  debugLog(`Found symbol position at line ${symbolPosition.line}, character ${symbolPosition.character}`)

  try {
    debugLog(`Executing reference provider for ${document.uri.fsPath}`)
    
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeReferenceProvider",
      document.uri,
      symbolPosition
    )

    const count = locations?.length || 0
    debugLog(`Found ${count} references for '${symbolName}'`)
    return count
  } catch (error) {
    debugLog(`ERROR finding references: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      debugLog(`Stack trace: ${error.stack}`)
    }
    return 0
  }
}

/**
 * Find all references to a symbol
 * @param document The document containing the symbol
 * @param symbolName The name of the symbol to find references for
 * @param position Optional position of the symbol
 * @returns An array of locations where the symbol is referenced
 */
export async function findReferences(
  document: vscode.TextDocument,
  symbolName: string,
  lineNumber?: number
): Promise<vscode.Location[]> {
  debugLog(`Starting search for '${symbolName}' in ${document.uri.fsPath}`)
  debugLog(`Document language: ${document.languageId}`)
  
  // Find all matching symbols (to handle overloads)
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    document.uri
  )
  
  if (!symbols || symbols.length === 0) {
    debugLog(`No symbols found in ${document.uri.fsPath}`)
    return []
  }
  
  // Find all matching symbols with the given name
  const matchingSymbols: vscode.DocumentSymbol[] = []
  
  const findMatchingSymbols = (symbols: vscode.DocumentSymbol[]): void => {
    for (const symbol of symbols) {
      if (symbol.name === symbolName &&
          (symbol.kind === vscode.SymbolKind.Function ||
           symbol.kind === vscode.SymbolKind.Method ||
           symbol.kind === vscode.SymbolKind.Constructor ||
           symbol.kind === vscode.SymbolKind.Property ||
           symbol.kind === vscode.SymbolKind.Field ||
           symbol.kind === vscode.SymbolKind.Variable ||
           symbol.kind === vscode.SymbolKind.Constant ||
           symbol.kind === vscode.SymbolKind.Class ||
           symbol.kind === vscode.SymbolKind.Interface ||
           symbol.kind === vscode.SymbolKind.Enum ||
           symbol.kind === vscode.SymbolKind.EnumMember)) {
        matchingSymbols.push(symbol)
      }
      
      if (symbol.children.length > 0) {
        findMatchingSymbols(symbol.children)
      }
    }
  }
  
  findMatchingSymbols(symbols)
  
  // If we found matching symbols, log them
  if (matchingSymbols.length > 0) {
    debugLog(`Found ${matchingSymbols.length} matching symbol(s) named '${symbolName}'`)
    
    // If line number is provided, filter to the symbol at that line
    if (lineNumber !== undefined) {
      const symbolsAtLine = matchingSymbols.filter(s =>
        s.range.start.line <= lineNumber && s.range.end.line >= lineNumber)
      
      if (symbolsAtLine.length > 0) {
        debugLog(`Found ${symbolsAtLine.length} symbol(s) at line ${lineNumber}`)
        matchingSymbols.length = 0 // Clear the array
        matchingSymbols.push(...symbolsAtLine)
      }
    }
  } else {
    debugLog(`No matching symbols found for '${symbolName}'`)
    return []
  }
  
  // Get references for all matching symbols
  const allLocations: vscode.Location[] = []
  
  for (const symbol of matchingSymbols) {
    const symbolPosition = symbol.selectionRange.start
    
    debugLog(`Finding references for symbol at line ${symbolPosition.line}, character ${symbolPosition.character}`)
    
    try {
      debugLog(`Executing reference provider for '${symbolName}' at position ${symbolPosition.line},${symbolPosition.character}`)
      
      const locations = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeReferenceProvider",
        document.uri,
        symbolPosition
      )
      
      if (locations && locations.length > 0) {
        debugLog(`Found ${locations.length} references for symbol at line ${symbolPosition.line}`)
        allLocations.push(...locations)
      }
    } catch (error) {
      debugLog(`ERROR finding references for symbol at line ${symbolPosition.line}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  // Remove duplicates (same file and position)
  const uniqueLocations: vscode.Location[] = []
  const seen = new Set<string>()
  
  for (const location of allLocations) {
    const key = `${location.uri.fsPath}:${location.range.start.line}:${location.range.start.character}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueLocations.push(location)
    }
  }

  const count = uniqueLocations.length
  
  if (count === 0) {
    debugLog(`No references found for '${symbolName}'`)
  } else {
    debugLog(`Found ${count} unique references for '${symbolName}' across ${matchingSymbols.length} overloads`)
    
    // Log the first few references for debugging
    const maxToLog = Math.min(count, 5)
    for (let i = 0; i < maxToLog; i++) {
      const loc = uniqueLocations[i]
      debugLog(`Reference ${i+1}: ${loc.uri.fsPath}:${loc.range.start.line},${loc.range.start.character}`)
    }
  }
  
  // Show the output channel to make sure logs are visible
  debugChannel.show(true);
  
  return uniqueLocations
}

/**
 * Check if the number of references exceeds the threshold
 * @param count The number of references
 * @returns True if the count exceeds the threshold
 */
export function exceedsReferenceThreshold(count: number): boolean {
  return count > MAX_REFERENCES_THRESHOLD
}

/**
 * Format references with function context
 * @param locations The locations of the references
 * @param symbol The symbol being referenced
 * @returns A formatted string with the references
 */
async function formatReferences(
  locations: vscode.Location[],
  symbol: string
): Promise<string> {
  let result = `# References to '${symbol}'\n\n`

  // Group references by file
  const fileGroups = new Map<string, vscode.Location[]>()
  
  for (const location of locations) {
    const filePath = location.uri.fsPath
    if (!fileGroups.has(filePath)) {
      fileGroups.set(filePath, [])
    }
    fileGroups.get(filePath)!.push(location)
  }

  // Process each file
  for (const [filePath, locations] of fileGroups.entries()) {
    // Sort locations by line number
    locations.sort((a, b) => a.range.start.line - b.range.start.line)
    
    // Get workspace-relative path for display
    const workspaceFolders = vscode.workspace.workspaceFolders
    let displayPath = filePath
    
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspacePath = workspaceFolders[0].uri.fsPath
      // Try to make the path relative to the workspace
      if (filePath.startsWith(workspacePath)) {
        displayPath = filePath.substring(workspacePath.length)
        // Remove leading slash or backslash
        if (displayPath.startsWith('/') || displayPath.startsWith('\\')) {
          displayPath = displayPath.substring(1)
        }
      }
    }
    
    result += `## File: ${displayPath}\n\n`

    try {
      // Process each location
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath))
      
      // Group references by containing function or class
      const functionGroups = new Map<number, { header: string, references: Array<{ line: number, text: string }> }>()
      const classGroups = new Map<number, { header: string, references: Array<{ line: number, text: string }> }>()
      const standaloneReferences: Array<{ line: number, text: string }> = []
      
      for (const location of locations) {
        const line = location.range.start.line
        const lineText = document.lineAt(line).text.trim()
        
        // Try to get the containing function or class
        try {
          // First try to get containing function
          const functionSymbol = await getContainingFunction(document, location.range.start)
      
          if (functionSymbol) {
            // Group by function
            const functionHeaderLine = functionSymbol.range.start.line
            const functionHeader = document.lineAt(functionHeaderLine).text
            
            if (!functionGroups.has(functionHeaderLine)) {
              functionGroups.set(functionHeaderLine, {
                header: functionHeader,
                references: []
              })
            }
            
            // Only add if it's not the function declaration itself
            if (functionHeaderLine !== line) {
              functionGroups.get(functionHeaderLine)!.references.push({
                line: line,
                text: lineText
              })
            } else {
              // It's the function declaration itself
              if (!functionGroups.has(functionHeaderLine)) {
                functionGroups.set(functionHeaderLine, {
                  header: functionHeader,
                  references: []
                })
              }
            }
          } else {
            // Try to get containing class or other symbol
            const classSymbol = await getContainingSymbol(
              document,
              location.range.start,
              [
                vscode.SymbolKind.Class,
                vscode.SymbolKind.Interface,
                vscode.SymbolKind.Enum,
                vscode.SymbolKind.Struct
              ]
            )
            
            if (classSymbol) {
              // Group by class
              const classHeaderLine = classSymbol.range.start.line
              const classHeader = document.lineAt(classHeaderLine).text
              
              if (!classGroups.has(classHeaderLine)) {
                classGroups.set(classHeaderLine, {
                  header: classHeader,
                  references: []
                })
              }
              
              // Only add if it's not the class declaration itself
              if (classHeaderLine !== line) {
                classGroups.get(classHeaderLine)!.references.push({
                  line: line,
                  text: lineText
                })
              } else {
                // It's the class declaration itself
                if (!classGroups.has(classHeaderLine)) {
                  classGroups.set(classHeaderLine, {
                    header: classHeader,
                    references: []
                  })
                }
              }
            } else {
              // No containing function or class, add to standalone references
              standaloneReferences.push({
                line: line,
                text: lineText
              })
            }
          }
        } catch (error) {
          // Add to standalone references if we can't get the containing function
          standaloneReferences.push({
            line: line,
            text: lineText
          })
        }
      }
      
      // Output function groups
      for (const [functionLine, group] of functionGroups.entries()) {
        // Get the full function range
        const functionSymbol = await getContainingFunction(document, new vscode.Position(functionLine, 0))
        const functionStartLine = functionSymbol ? functionSymbol.range.start.line + 1 : functionLine + 1
        const functionEndLine = functionSymbol ? functionSymbol.range.end.line + 1 : functionLine + 1
        
        result += `### ${group.header.trim()} (lines ${functionStartLine}-${functionEndLine})\n`
        
        // Add references within this function
        if (group.references.length > 0) {
          for (const ref of group.references) {
            result += `Line ${ref.line + 1}: \`${ref.text}\`\n`
          }
        } else {
          // This is a direct reference to the function/method itself
          result += `*Function declaration*\n`
        }
        
        // Add a note about how to read the full function
        result += `\n*To read this function:* Use \`read_file\` with \`<start_line>${functionStartLine}</start_line>\` and \`<end_line>${functionEndLine}</end_line>\`\n\n`
      }
      
      // Output class groups
      for (const [classLine, group] of classGroups.entries()) {
        // Get the full class range
        const classSymbol = await getContainingSymbol(
          document,
          new vscode.Position(classLine, 0),
          [
            vscode.SymbolKind.Class,
            vscode.SymbolKind.Interface,
            vscode.SymbolKind.Enum,
            vscode.SymbolKind.Struct
          ]
        )
        const classStartLine = classSymbol ? classSymbol.range.start.line + 1 : classLine + 1
        const classEndLine = classSymbol ? classSymbol.range.end.line + 1 : classLine + 1
        
        result += `### ${group.header.trim()} (lines ${classStartLine}-${classEndLine})\n`
        
        // Add references within this class
        if (group.references.length > 0) {
          for (const ref of group.references) {
            result += `Line ${ref.line + 1}: \`${ref.text}\`\n`
          }
        } else {
          // This is a direct reference to the class itself
          result += `*Class declaration*\n`
        }
        
        // Add a note about how to read the full class
        result += `\n*To read this class:* Use \`read_file\` with \`<start_line>${classStartLine}</start_line>\` and \`<end_line>${classEndLine}</end_line>\`\n\n`
      }
      
      // Output standalone references
      if (standaloneReferences.length > 0) {
        result += "### Other references\n"
        for (const ref of standaloneReferences) {
          result += `Line ${ref.line + 1}: \`${ref.text}\`\n`
        }
        result += "\n"
      }
    } catch (error) {
      result += `Error processing file\n\n`
    }
    
    result += "---\n\n"
  }

  // Add summary
  const totalFiles = fileGroups.size
  const totalReferences = locations.length
  result += `**Summary**: Found ${totalReferences} references in ${totalFiles} files.`

  return result
}

export { formatReferences }