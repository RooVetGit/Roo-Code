import { ToolDefinition } from "./types"

export const consolidateResultsToolDefinition: ToolDefinition = {
	name: "consolidate_results",
	description:
		"Waits for one or more dispatched sub-tasks (identified by their instance IDs) to complete, fail, or be aborted. This is a blocking tool; the current task will pause until all specified sub-tasks have terminated. It then returns an aggregated list of their final statuses and results. After using this, consider calling `release_tasks` to clean up terminated task records.",
	parameters: [
		{
			name: "task_instance_ids",
			description:
				"A comma-separated string of task instance IDs whose results are to be consolidated (e.g., 'id1,id2,id3').",
			type: "string",
			required: true,
		},
	],
}
