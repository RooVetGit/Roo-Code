import { ToolArgs } from "../../prompts/tools/types"
import { BaseToolSchema } from "./base-tool-schema"

const baseSwitchModeSchema: BaseToolSchema = {
	name: "switch_mode",
	description:
		"Request to switch to a different mode. This tool allows modes to request switching to another mode when needed, such as switching to Code mode to make code changes. The user must approve the mode switch.",
	parameters: [
		{
			name: "mode_slug",
			type: "string",
			description: "The slug of the mode to switch to (e.g., 'code', 'ask', 'architect')",
			required: true,
		},
		{
			name: "reason",
			type: "string",
			description: "The reason for switching modes",
			required: false,
		},
	],
}

export const switchModeSchema: BaseToolSchema = {
	...baseSwitchModeSchema,
}
