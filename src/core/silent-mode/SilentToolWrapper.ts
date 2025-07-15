import type { Task } from "../task/Task"
import type { FileOperation } from "./types"
import { SilentModeController } from "./SilentModeController"

/**
 * Wrapper for file writing tools to operate in silent mode
 *
 * This class intercepts file operations and routes them through the
 * Silent Mode system when appropriate, while falling back to normal
 * operation when silent mode is not active or applicable.
 */
export class SilentToolWrapper {
	/**
	 * Gets the Silent Mode controller for a task
	 */
	private static getSilentModeController(task: Task): SilentModeController | null {
		// Use the task's properly initialized silent mode controller
		return task.getSilentModeController()
	}

	/**
	 * Wraps file writing tools to operate in silent mode
	 *
	 * @param originalTool - The original tool function to wrap
	 * @param task - The current task instance
	 * @param args - Arguments passed to the original tool
	 */
	public static async wrapFileWriteTool(
		originalTool: (...args: any[]) => Promise<any>,
		task: Task,
		...args: any[]
	): Promise<any> {
		const controller = this.getSilentModeController(task)

		// If no controller or silent mode not active, execute normally
		if (!controller) {
			return await originalTool(...args)
		}

		// Extract file operation details from the tool arguments
		const operation = this.extractFileOperationFromArgs(args)

		if (operation && controller.shouldOperateInSilentMode(operation)) {
			// Execute in silent mode
			const result = await controller.executeInSilentMode(operation)

			if (result.success) {
				// Return a result that mimics the original tool's successful response
				return {
					success: true,
					message: result.message,
					silent: true,
				}
			} else {
				// Fall back to interactive mode if silent mode fails
				console.warn(
					`Silent mode failed for ${operation.filePath}, falling back to interactive mode:`,
					result.message,
				)
				return await originalTool(...args)
			}
		} else {
			// Execute normally (not in silent mode)
			return await originalTool(...args)
		}
	}

	/**
	 * Wraps diff application tools for silent mode
	 *
	 * @param originalTool - The original diff tool function
	 * @param task - The current task instance
	 * @param args - Arguments passed to the original tool
	 */
	public static async wrapDiffTool(
		originalTool: (...args: any[]) => Promise<any>,
		task: Task,
		...args: any[]
	): Promise<any> {
		const controller = this.getSilentModeController(task)

		// If no controller or silent mode not active, execute normally
		if (!controller) {
			return await originalTool(...args)
		}

		// Extract file operations from diff arguments
		const operations = this.extractDiffOperationsFromArgs(args)

		// Check if all operations should be handled silently
		const shouldUseSilentMode =
			operations.length > 0 && operations.every((op) => controller.shouldOperateInSilentMode(op))

		if (shouldUseSilentMode) {
			// Execute all operations in silent mode
			const results = await Promise.all(operations.map((op) => controller.executeInSilentMode(op)))

			const allSuccessful = results.every((r: any) => r.success)

			if (allSuccessful) {
				return {
					success: true,
					message: `Applied ${operations.length} changes in silent mode`,
					silent: true,
					filesModified: operations.map((op) => op.filePath),
				}
			} else {
				// Fall back to interactive mode if any operation fails
				const failed = results.filter((r: any) => !r.success)
				console.warn(`Silent mode failed for ${failed.length} operations, falling back to interactive mode`)
				return await originalTool(...args)
			}
		} else {
			// Execute normally
			return await originalTool(...args)
		}
	}

	/**
	 * Shows completion review for a task
	 */
	public static async showTaskCompletionReview(task: Task): Promise<void> {
		const controller = this.getSilentModeController(task)
		if (controller && controller.active) {
			await controller.showCompletionReview()
		}
	}

	/**
	 * Applies approved changes for a task
	 */
	public static async applyApprovedChanges(task: Task, approvedChanges: any[]): Promise<void> {
		const controller = this.getSilentModeController(task)
		if (controller) {
			await controller.applyChanges(approvedChanges)
		}
	}

	/**
	 * Cancels silent mode for a task
	 */
	public static cancelSilentMode(task: Task): void {
		const controller = this.getSilentModeController(task)
		if (controller) {
			controller.cancel()
			// The original code had this line, but it's no longer needed here
			// as the controller is managed by the task itself.
			// this.silentModeControllers.delete(task.taskId)
		}
	}

	/**
	 * Cleans up silent mode controllers for completed tasks
	 */
	public static cleanup(taskId: string): void {
		// This method is no longer needed as SilentModeController is managed by Task
		// this.silentModeControllers.delete(taskId)
	}

	/**
	 * Extracts file operation details from tool arguments
	 * This parses the actual argument format used by writeToFileTool and applyDiffTool
	 */
	private static extractFileOperationFromArgs(args: any[]): FileOperation | null {
		// For writeToFileTool, args structure is:
		// args[0] = originalTool function
		// args[1] = task
		// args[2] = { relPath, newContent, predictedLineCount, block, cline, askApproval, handleError, pushToolResult, removeClosingTag }

		if (args.length < 3) {
			console.log("[SilentMode] extractFileOperationFromArgs: insufficient arguments", args.length)
			return null
		}

		const toolArgs = args[2]

		if (typeof toolArgs === "object" && toolArgs !== null) {
			const { relPath, newContent, block } = toolArgs

			if (typeof relPath === "string") {
				console.log("[SilentMode] extractFileOperationFromArgs: extracted operation for", relPath)
				return {
					type: "modify", // We'll determine this based on file existence later
					filePath: relPath,
					content: typeof newContent === "string" ? newContent : undefined,
					originalContent: undefined, // Will be determined during execution
				}
			}
		}

		console.log("[SilentMode] extractFileOperationFromArgs: failed to extract operation from args", toolArgs)
		return null
	}

	/**
	 * Extracts diff operation details from diff tool arguments
	 */
	private static extractDiffOperationsFromArgs(args: any[]): FileOperation[] {
		// For applyDiffTool, args structure is:
		// args[0] = originalTool function
		// args[1] = task
		// args[2] = { block, cline, askApproval, handleError, pushToolResult, removeClosingTag }

		if (args.length < 3) {
			console.log("[SilentMode] extractDiffOperationsFromArgs: insufficient arguments", args.length)
			return []
		}

		const toolArgs = args[2]

		if (typeof toolArgs === "object" && toolArgs !== null) {
			const { block } = toolArgs

			if (block && block.params && block.params.path) {
				console.log(
					"[SilentMode] extractDiffOperationsFromArgs: extracted diff operation for",
					block.params.path,
				)
				return [
					{
						type: "modify",
						filePath: block.params.path,
						content: block.params.new_str || block.params.content,
						originalContent: block.params.old_str,
					},
				]
			}
		}

		console.log("[SilentMode] extractDiffOperationsFromArgs: failed to extract operations from args", toolArgs)
		return []
	}
}
