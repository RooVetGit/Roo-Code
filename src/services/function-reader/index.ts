import * as vscode from "vscode"
import { findFunctionsByName } from "../language-services"

/**
 * Read all functions with a given name from a document (including overloads)
 * @param document The document containing the function
 * @param functionName The name of the function to read
 * @returns The function text with line numbers for all matching functions, or undefined if not found
 */
export async function readFunctionsByName(
  document: vscode.TextDocument,
  functionName: string
): Promise<string | undefined> {
  const functionSymbols = await findFunctionsByName(document, functionName)
  
  if (!functionSymbols || functionSymbols.length === 0) {
    return undefined
  }

  // Format all matching functions
  let result = ""
  
  // If there are multiple matches, add a header
  if (functionSymbols.length > 1) {
    result += `# Found ${functionSymbols.length} overloads of '${functionName}'\n\n`
  }
  
  // Format each function
  for (let i = 0; i < functionSymbols.length; i++) {
    if (i > 0) {
      result += "\n---\n\n" // Add separator between functions
    }
    result += formatFunctionText(document, functionSymbols[i], i + 1, functionSymbols.length)
  }

  return result
}

/**
 * For backward compatibility
 * @deprecated Use readFunctionsByName instead
 */
export async function readFunctionByName(
  document: vscode.TextDocument,
  functionName: string
): Promise<string | undefined> {
  return readFunctionsByName(document, functionName)
}

/**
 * Format a function's text with line numbers
 * @param document The document containing the function
 * @param functionSymbol The function symbol
 * @returns The formatted function text
 */
function formatFunctionText(
  document: vscode.TextDocument,
  functionSymbol: vscode.DocumentSymbol,
  overloadIndex?: number,
  totalOverloads?: number
): string {
  const startLine = functionSymbol.range.start.line
  const endLine = functionSymbol.range.end.line
  
  let result = ""
  
  // Add overload information if provided
  if (overloadIndex !== undefined && totalOverloads !== undefined && totalOverloads > 1) {
    result += `# Function: ${functionSymbol.name} (Overload ${overloadIndex} of ${totalOverloads})\n`
  } else {
    result += `# Function: ${functionSymbol.name}\n`
  }
  
  // Add file and line information
  result += `## Location: ${document.fileName.split(/[/\\]/).pop()}:${startLine + 1}-${endLine + 1}\n\n`
  
  // Extract and format each line of the function
  for (let i = startLine; i <= endLine; i++) {
    const line = document.lineAt(i)
    result += `${i + 1} | ${line.text}\n`
  }
  
  return result
}

/**
 * Read a function at a specific line in a document
 * @param document The document containing the function
 * @param line The line number where the function is located
 * @returns The function text with line numbers, or undefined if not found
 */
export async function readFunctionAtLine(
  document: vscode.TextDocument,
  line: number
): Promise<string | undefined> {
  const position = new vscode.Position(line, 0)
  
  // Get all symbols in the document
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    document.uri
  )
  
  if (!symbols || symbols.length === 0) {
    return undefined
  }
  
  // Find the function that contains the line
  const findContainingFunction = (symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined => {
    for (const symbol of symbols) {
      if (
        symbol.range.contains(position) &&
        (symbol.kind === vscode.SymbolKind.Function || 
         symbol.kind === vscode.SymbolKind.Method ||
         symbol.kind === vscode.SymbolKind.Constructor)
      ) {
        return symbol
      }
      
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
  
  if (!functionSymbol) {
    return undefined
  }
  
  return formatFunctionText(document, functionSymbol)
}