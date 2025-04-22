import { z } from "zod"

export const ToolName = {
	START_NEW_TASK: "newTask",
	SEND_MESSAGE: "sendMessage",
	PRESS_PRIMARY_BUTTON: "pressPrimaryButton",
	PRESS_SECONDARY_BUTTON: "pressSecondaryButton",
} as const

export const NewTaskMessageSchema = z.object({
	task: z
		.string()
		.describe(
			"The first instruction to start a new task. You can use @ with relative path to add context, or use an absolute path when you want take some references from local files",
		),
})

export const SendMessageSchema = z.object({
	message: z
		.string()
		.describe(
			"The message to send for giving some feedback or provide some relections at current task. You can use @ with relative path to add context, or use an absolute path when you want take some references from local files",
		),
})

export const PressPrimaryButtonSchema = z.object({
	invoke: z.boolean().describe("When true, the primary button will be pressed, to approve some actions."),
})

export const PressSecondaryButtonSchema = z.object({
	invoke: z.boolean().describe("When true, the secondary button will be pressed, to cancel some actions."),
})

export const ASK_REPLY_EVENT = "ask_reply_event"

export type Event = {
	event: string
	data?: any
}
