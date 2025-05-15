import * as vscode from "vscode"
import * as path from "path"
import { Task } from "../task/Task"
import { ReadFunctionToolUse, PushToolResult, AskApproval } from "../../shared/tools"
import { readFunctionsByName } from "../../services/function-reader"
import { ToolProgressStatus } from "../../schemas"
import { ClineSayTool } from "../../shared/ExtensionMessage"

/**
 * Implementation of the Read Function Tool
 * This tool reads a specific function or method definition from a file
 */
export async function readFunctionTool(
  task: Task,
  toolUse: ReadFunctionToolUse,
  pushToolResult: PushToolResult,
  askApproval: AskApproval
): Promise<void> {
  // Extract parameters
  const symbol = toolUse.params.symbol
  const file_path = toolUse.params.file_path
  
  // Create shared message properties for UI
  const sharedMessageProps: ClineSayTool = {
    tool: "readFunction",
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
    pushToolResult("Error: Symbol parameter is required")
    return
  }
  
  if (!file_path) {
    pushToolResult("Error: File path parameter is required")
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
    const document = await vscode.workspace.openTextDocument(uri)
    
    // Show progress status
    const progressStatus: ToolProgressStatus = {
      icon: "code",
      text: `Reading function '${symbol}' from ${path.basename(file_path)}...`,
    }
    
    const completeMessage = JSON.stringify({
      ...sharedMessageProps,
      // Don't include content field to avoid showing the log message
      content: undefined
    } satisfies ClineSayTool)
    
    // Let askApproval handle auto-approval logic internally
    const didApprove = await askApproval("tool", completeMessage, progressStatus)
    
    if (!didApprove) {
      pushToolResult("Operation cancelled by user")
      return
    }
    
    // Read the function (including all overloads)
    const functionText = await readFunctionsByName(document, symbol)
    
    if (!functionText) {
      pushToolResult(`Function '${symbol}' not found in ${file_path}`)
      return
    }
    
    // Format the result into the required XML structure similar to readFileTool
    const xmlResult = `<file><path>${file_path}</path>\n<functions>\n${functionText}</functions>\n</file>`
    pushToolResult(xmlResult)
  } catch (error) {
    pushToolResult(`Error reading function: ${error instanceof Error ? error.message : String(error)}`)
  }
}