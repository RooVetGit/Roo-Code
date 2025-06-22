import { ToolDefinition } from "./types"

export const releaseTasksToolDefinition: ToolDefinition = {
	name: "release_tasks",
	description:
		"Releases the records of one or more terminated (completed, failed, or aborted) sub-tasks from active memory. This should be called after results have been consolidated and the task records are no longer needed. This tool only affects tasks that are already in a terminal state.",
	parameters: [
		{
			name: "task_instance_ids",
			description:
				"A comma-separated string of task instance IDs whose records are to be released (e.g., 'id1,id2,id3').",
			type: "string",
			required: true,
		},
	],
}
