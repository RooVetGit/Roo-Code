import { BaseTool } from "./BaseTool"
import { ReadFileTool } from "./implementations/ReadFileTool"
import { WriteToFileTool } from "./implementations/WriteToFileTool"
import { ListFilesTool } from "./implementations/ListFilesTool"
import { SearchFilesTool } from "./implementations/SearchFilesTool"
import { ExecuteCommandTool } from "./implementations/ExecuteCommandTool"
import { BrowserActionTool } from "./implementations/BrowserActionTool"
import { ApplyDiffTool } from "./implementations/ApplyDiffTool"
import { InsertContentTool } from "./implementations/InsertContentTool"
import { SearchAndReplaceTool } from "./implementations/SearchAndReplaceTool"
import { ListCodeDefinitionNamesTool } from "./implementations/ListCodeDefinitionNamesTool"
import { UseMcpToolTool } from "./implementations/UseMcpToolTool"
import { AccessMcpResourceTool } from "./implementations/AccessMcpResourceTool"
import { AskFollowupQuestionTool } from "./implementations/AskFollowupQuestionTool"
import { SwitchModeTool } from "./implementations/SwitchModeTool"
import { AttemptCompletionTool } from "./implementations/AttemptCompletionTool"
import { NewTaskTool } from "./implementations/NewTaskTool"
import { FetchInstructionsTool } from "./implementations/FetchInstructionsTool"
import { ToolUseName } from "../assistant-message"

/**
 * Factory class for creating tool instances
 */
export class ToolFactory {
	private static instance: ToolFactory
	private toolInstances: Map<string, BaseTool> = new Map()

	/**
	 * Get the singleton instance of ToolFactory
	 *
	 * @returns The ToolFactory instance
	 */
	public static getInstance(): ToolFactory {
		if (!ToolFactory.instance) {
			ToolFactory.instance = new ToolFactory()
		}
		return ToolFactory.instance
	}

	/**
	 * Private constructor to enforce singleton pattern
	 */
	private constructor() {
		// Initialize tool instances
		this.registerTools()
	}

	/**
	 * Register all available tools
	 */
	private registerTools(): void {
		// Register all tools
		this.registerTool(new ReadFileTool())
		this.registerTool(new WriteToFileTool())
		this.registerTool(new ListFilesTool())
		this.registerTool(new SearchFilesTool())
		this.registerTool(new ExecuteCommandTool())
		this.registerTool(new BrowserActionTool())
		this.registerTool(new ApplyDiffTool())
		this.registerTool(new InsertContentTool())
		this.registerTool(new SearchAndReplaceTool())
		this.registerTool(new ListCodeDefinitionNamesTool())
		this.registerTool(new UseMcpToolTool())
		this.registerTool(new AccessMcpResourceTool())
		this.registerTool(new AskFollowupQuestionTool())
		this.registerTool(new SwitchModeTool())
		this.registerTool(new AttemptCompletionTool())
		this.registerTool(new NewTaskTool())
		this.registerTool(new FetchInstructionsTool())
	}

	/**
	 * Register a tool
	 *
	 * @param tool The tool to register
	 */
	public registerTool(tool: BaseTool): void {
		this.toolInstances.set(tool.getName(), tool)
	}

	/**
	 * Get a tool by name
	 *
	 * @param name The name of the tool
	 * @returns The tool instance or undefined if not found
	 */
	public getTool(name: ToolUseName): BaseTool | undefined {
		return this.toolInstances.get(name)
	}

	/**
	 * Check if a tool exists
	 *
	 * @param name The name of the tool
	 * @returns True if the tool exists, false otherwise
	 */
	public hasTool(name: string): boolean {
		return this.toolInstances.has(name)
	}

	/**
	 * Get all registered tools
	 *
	 * @returns Map of all registered tools
	 */
	public getAllTools(): Map<string, BaseTool> {
		return this.toolInstances
	}
}
