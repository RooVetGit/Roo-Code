// src/core/tool-handlers/ToolUseHandlerFactory.ts
import { ToolUse, ToolUseName } from "../assistant-message"
import { Cline } from "../Cline"
import { ToolUseHandler } from "./ToolUseHandler"
// Import statements for individual handlers (files will be created later)
import { WriteToFileHandler } from "./tools/WriteToFileHandler"
import { ReadFileHandler } from "./tools/ReadFileHandler"
import { ExecuteCommandHandler } from "./tools/ExecuteCommandHandler"
import { ApplyDiffHandler } from "./tools/ApplyDiffHandler"
import { SearchFilesHandler } from "./tools/SearchFilesHandler"
import { ListFilesHandler } from "./tools/ListFilesHandler"
import { ListCodeDefinitionNamesHandler } from "./tools/ListCodeDefinitionNamesHandler"
import { BrowserActionHandler } from "./tools/BrowserActionHandler"
import { UseMcpToolHandler } from "./tools/UseMcpToolHandler"
import { AccessMcpResourceHandler } from "./tools/AccessMcpResourceHandler"
import { AskFollowupQuestionHandler } from "./tools/AskFollowupQuestionHandler"
import { AttemptCompletionHandler } from "./tools/AttemptCompletionHandler"
import { SwitchModeHandler } from "./tools/SwitchModeHandler"
import { NewTaskHandler } from "./tools/NewTaskHandler"
import { FetchInstructionsHandler } from "./tools/FetchInstructionsHandler"
import { InsertContentHandler } from "./tools/InsertContentHandler"
import { SearchAndReplaceHandler } from "./tools/SearchAndReplaceHandler"
import { formatResponse } from "../prompts/responses" // Needed for error handling

export class ToolUseHandlerFactory {
	static createHandler(cline: Cline, toolUse: ToolUse): ToolUseHandler | null {
		try {
			switch (toolUse.name) {
				case "write_to_file":
					return new WriteToFileHandler(cline, toolUse)
				case "read_file":
					return new ReadFileHandler(cline, toolUse)
				case "execute_command":
					return new ExecuteCommandHandler(cline, toolUse)
				case "apply_diff":
					return new ApplyDiffHandler(cline, toolUse)
				case "search_files":
					return new SearchFilesHandler(cline, toolUse)
				case "list_files":
					return new ListFilesHandler(cline, toolUse)
				case "list_code_definition_names":
					return new ListCodeDefinitionNamesHandler(cline, toolUse)
				case "browser_action":
					return new BrowserActionHandler(cline, toolUse)
				case "use_mcp_tool":
					return new UseMcpToolHandler(cline, toolUse)
				case "access_mcp_resource":
					return new AccessMcpResourceHandler(cline, toolUse)
				case "ask_followup_question":
					return new AskFollowupQuestionHandler(cline, toolUse)
				case "attempt_completion":
					return new AttemptCompletionHandler(cline, toolUse)
				case "switch_mode":
					return new SwitchModeHandler(cline, toolUse)
				case "new_task":
					return new NewTaskHandler(cline, toolUse)
				case "fetch_instructions":
					return new FetchInstructionsHandler(cline, toolUse)
				case "insert_content":
					return new InsertContentHandler(cline, toolUse)
				case "search_and_replace":
					return new SearchAndReplaceHandler(cline, toolUse)
				default:
					// Handle unknown tool names gracefully
					console.error(`No handler found for tool: ${toolUse.name}`)
					// It's important the main loop handles this null return
					// by pushing an appropriate error message back to the API.
					// We avoid throwing an error here to let the caller decide.
					return null
			}
		} catch (error) {
			// Catch potential errors during handler instantiation (though unlikely with current structure)
			console.error(`Error creating handler for tool ${toolUse.name}:`, error)
			// Push an error result back to the API via Cline instance
			// Pass both the toolUse object and the error content
			cline.pushToolResult(
				toolUse,
				formatResponse.toolError(`Error initializing handler for tool ${toolUse.name}.`),
			)
			return null // Indicate failure to create handler
		}
	}
}
