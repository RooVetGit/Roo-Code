import { ToolDefinition } from "./types"

export const resumeParentTaskToolDefinition: ToolDefinition = {
	name: "resume_parent_task",
	description:
		"Called by a mediator agent after it has processed a task's original result. This tool signals that the original parent task (if one exists) should now be resumed using the (potentially modified) result provided by the mediator. If the original task was a root task, this tool indicates the mediation is complete.",
	parameters: [
		{
			name: "original_parent_id",
			description:
				"The instance ID of the original parent task that was awaiting mediation. Should be 'null' (as a string) if the original task was a root task.",
			type: "string", // Will be parsed, 'null' string for actual null
			required: true,
		},
		{
			name: "mediated_result",
			description: "The final result (potentially modified by the mediator) to be passed to the original parent task or considered the final output if the original was a root task.",
			type: "string",
			required: true,
		},
	],
}
