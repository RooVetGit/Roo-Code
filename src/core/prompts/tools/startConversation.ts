import { ToolDefinition } from "./types"

export const startConversationToolDefinition: ToolDefinition = {
	name: "start_conversation",
	description:
		"Initiates and manages a structured, turn-by-turn conversation (debate) between two dynamically defined AI agents to collaboratively refine ideas, critique plans, or create artifacts. The conversation continues until a specified termination condition is met, as judged by a referee LLM. Returns the full conversation transcript.",
	parameters: [
		{
			name: "participants",
			description:
				"A JSON string representing an array of two participant agent definitions. Each definition object should have: `base_mode` (optional string, e.g., 'code', 'architect', defaults to general agent mode) and `dynamic_persona_instructions` (required string, specific instructions for this agent in this conversation). Example: '[{\"base_mode\": \"code\", \"dynamic_persona_instructions\": \"You are a senior Python developer. Focus on code clarity and efficiency.\"}, {\"dynamic_persona_instructions\": \"You are a QA engineer. Focus on edge cases and potential bugs.\"}]'",
			type: "string", // JSON string
			required: true,
		},
		{
			name: "shared_context",
			description: "The initial data, document, code snippet, or problem statement that the conversation should be based on. This will be provided to both agents.",
			type: "string",
			required: true,
		},
		{
			name: "initial_prompt",
			description: "The first message to start the conversation, which will be delivered to the first participant.",
			type: "string",
			required: true,
		},
		{
			name: "termination_condition",
			description: "A clear, objective question that a referee LLM will use to determine if the debate is over after each round (e.g., 'Have the participants produced a final, agreed-upon list of changes?'). The referee will answer 'yes' or 'no'.",
			type: "string",
			required: true,
		},
	],
}
