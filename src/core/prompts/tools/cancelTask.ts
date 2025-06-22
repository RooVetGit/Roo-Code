import { ToolDefinition } from "./types"

export const cancelTaskToolDefinition: ToolDefinition = {
	name: "cancel_task",
	description:
		"Requests the cancellation of an actively running sub-task previously dispatched by `dispatch_task`. The target task will be moved to an 'aborted' state. This does not immediately remove the task record; use `release_tasks` for cleanup after confirming cancellation if needed.",
	parameters: [
		{
			name: "task_instance_id",
			description: "The instance ID of the task to be cancelled.",
			type: "string",
			required: true,
		},
	],
}
