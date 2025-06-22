import { ToolDefinition } from "./types"

export const getTaskStatusToolDefinition: ToolDefinition = {
	name: "get_task_status",
	description:
		"Checks the current status of one or more actively running sub-tasks that were previously dispatched using `dispatch_task`. Tasks are identified by their instance IDs. If a task ID is not found among active tasks, its status will be reported as 'unknown'. To get final results of completed/failed tasks, use `consolidate_results`.",
	parameters: [
		{
			name: "task_instance_ids",
			description:
				"A comma-separated string of task instance IDs for which to retrieve the status (e.g., 'id1,id2,id3').",
			type: "string",
			required: true,
		},
	],
}
