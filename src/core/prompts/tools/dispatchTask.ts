import { ToolDefinition } from "./types"

export const dispatchTaskToolDefinition: ToolDefinition = {
	name: "dispatch_task",
	description:
		"Dispatches a new sub-task to be executed in parallel. This tool is non-blocking; the current task will continue to execute immediately after dispatching the sub-task. The sub-task will run independently. Use `get_task_status` to check its progress and `consolidate_results` to retrieve its output once completed.",
	parameters: [
		{
			name: "mode",
			description:
				"The mode (persona or capability set) in which the new sub-task should operate (e.g., 'code', 'debug', 'architect', or a custom mode slug).",
			type: "string",
			required: true,
		},
		{
			name: "message",
			description: "The initial message or instruction for the new sub-task.",
			type: "string",
			required: true,
		},
	],
}
