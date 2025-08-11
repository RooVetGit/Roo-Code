import { z } from "zod"

import type { ClineMessage, HistoryItem } from "@roo-code/types"

// Base schema for a single message in the chat history
const MessageSchema = z.custom<ClineMessage>()

// Schema for the main task object
const TaskSchema = z.custom<HistoryItem>()

// Schema for the serialized session data that will be exported/imported
export const SerializedSessionSchema = z.object({
	version: z.string(),
	task: TaskSchema,
	messages: z.array(MessageSchema),
})

export type SerializedSession = z.infer<typeof SerializedSessionSchema>
