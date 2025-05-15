import * as vscode from "vscode"
import * as path from "path"
import { Task } from "../task/Task"
import { FindReferencesToolUse, PushToolResult, AskApproval } from "../../shared/tools"
import { countReferences, exceedsReferenceThreshold, findReferences, formatReferences } from "../../services/references"
import { ToolProgressStatus } from "../../schemas"
import { ClineSayTool } from "../../shared/ExtensionMessage"

/**
 * Implementation of the Find References Tool
 * This tool finds all references to a specific symbol across the workspace
 */
export async function findReferencesTool(
  task: Task,
  toolUse: FindReferencesToolUse,
  pushToolResult: PushToolResult,
  askApproval: AskApproval
): Promise<void> {
  // Extract parameters
  const symbol = toolUse.params.symbol
  const file_path = toolUse.params.file_path
  const line_number = toolUse.params.line_number
  
  // Create shared message properties for UI
  const sharedMessageProps: ClineSayTool = {
    tool: "findReferences",
    symbol: symbol,
    path: file_path,
  }
  
  // Disallow partial tool use - both symbol and file_path are required
  if (toolUse.partial) {
    // Return early without showing any UI
    return
  }
  
  // Validate required parameters
  if (!symbol) {
    vscode.window.showInformationMessage("[findReferencesTool] Symbol parameter is missing")
    pushToolResult("Error: Symbol parameter is required")
    return
  }
  
  if (!file_path) {
    vscode.window.showInformationMessage("[findReferencesTool] File path parameter is missing")
    pushToolResult("Error: File path parameter is required")
    return
  }
  
  if (!line_number) {
    vscode.window.showInformationMessage("[findReferencesTool] Line number parameter is missing")
    pushToolResult("Error: Line number parameter is required")
    return
  }
  
  try {
    // Resolve the file path
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
      pushToolResult("Error: No workspace folder is open")
      return
    }
    
    const workspacePath = workspaceFolders[0].uri.fsPath
    const absolutePath = path.isAbsolute(file_path)
      ? file_path
      : path.join(workspacePath, file_path)
    
    // Open the document
    const uri = vscode.Uri.file(absolutePath)
    try {
      const document = await vscode.workspace.openTextDocument(uri)
    
    // Convert line_number to a number
    const parsedLineNumber = parseInt(line_number, 10)
    if (isNaN(parsedLineNumber)) {
      pushToolResult("Error: Line number must be a valid number")
      return
    }
    const lineNumber = parsedLineNumber
    
    // Count references first to check threshold
    const progressStatus: ToolProgressStatus = {
      icon: "search",
      text: `Finding references to '${symbol}' in ${path.basename(file_path)}...`,
    }
    
    // Create the message without content field to avoid showing log message
    const completeMessage = JSON.stringify({
      ...sharedMessageProps,
      content: undefined
    } satisfies ClineSayTool)
    
    // Let askApproval handle auto-approval logic internally
    const didApprove = await askApproval("tool", completeMessage, progressStatus)
    
    if (!didApprove) {
      pushToolResult("Operation cancelled by user")
      return
    }
    
    // Count references
    const count = await countReferences(document, symbol, lineNumber)
    
    if (count === 0) {
      pushToolResult(`No references found for '${symbol}' in ${file_path}`)
      return
    }
    
    // Always require approval for a large number of references, regardless of auto-approval settings
    if (exceedsReferenceThreshold(count)) {
      const largeRefsMessage = JSON.stringify({
        ...sharedMessageProps,
        content: `Found ${count} references to '${symbol}'`,
        reason: "This is a large number and may consume significant context."
      } satisfies ClineSayTool)
      
      const largeRefsApproved = await askApproval(
        "tool",
        largeRefsMessage,
        {
          icon: "warning",
          text: `Found ${count} references to '${symbol}'. This is a large number and may consume significant context.`
        }
      )
      
      if (!largeRefsApproved) {
        pushToolResult(`Operation cancelled: Found ${count} references to '${symbol}', which exceeds the threshold.`)
        return
      }
    }
    
    // Find and format references
    const locations = await findReferences(document, symbol, lineNumber)
    const result = await formatReferences(locations, symbol)
    
    // Wrap the result in XML tags for proper display in the UI
    const xmlResult = `<file><path>${file_path}</path>\n<references>\n${result}</references>\n</file>`
    pushToolResult(xmlResult)
  } catch (error) {
    pushToolResult(`Error finding references: ${error instanceof Error ? error.message : String(error)}`)
  }
    } catch (docError) {
      pushToolResult(`Error finding references: cannot open ${file_path}. Detail: ${docError instanceof Error ? docError.message : String(docError)}`)
      return
    }
}