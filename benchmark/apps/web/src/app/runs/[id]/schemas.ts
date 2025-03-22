import { z } from "zod"

export const ipcServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("Ack"),
		data: z.object({ clientId: z.string() }),
	}),
	z.object({
		type: z.literal("TaskEvent"),
		data: z.object({
			eventName: z.enum(["connect", "taskStarted", "message", "taskTokenUsageUpdated", "taskFinished"]),
			data: z.object({
				task: z.object({ id: z.number() }),
				// message: z.object({}).optional(),
				// usage: z.object({}).optional(),
				// taskMetrics: z.object({}).optional(),
			}),
		}),
	}),
])
