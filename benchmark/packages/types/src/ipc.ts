import { z } from "zod"

/**
 * TaskEvent
 */

export enum TaskEventName {
	Connect = "Connect",
	TaskStarted = "TaskStarted",
	Message = "Message",
	TaskTokenUsageUpdated = "TaskTokenUsageUpdated",
	TaskFinished = "TaskFinished",
}

export const taskEventSchema = z.discriminatedUnion("eventName", [
	z.object({
		eventName: z.literal(TaskEventName.Connect),
		data: z.object({ task: z.object({ id: z.number() }) }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskStarted),
		data: z.object({ task: z.object({ id: z.number() }) }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.Message),
		data: z.object({
			task: z.object({ id: z.number() }),
			message: z.object({
				taskId: z.string(),
				action: z.enum(["created", "updated"]),
				message: z.object({
					// See ClineMessage.
					ts: z.number(),
					type: z.enum(["ask", "say"]),
					ask: z.string().optional(),
					say: z.string().optional(),
					partial: z.boolean().optional(),
					text: z.string().optional(),
					reasoning: z.string().optional(),
				}),
			}),
		}),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskTokenUsageUpdated),
		data: z.object({
			task: z.object({ id: z.number() }),
			usage: z.object({}),
		}),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskFinished),
		data: z.object({ task: z.object({ id: z.number() }), taskMetrics: z.unknown() }),
	}),
])

export type TaskEvent = z.infer<typeof taskEventSchema>

/**
 * TaskCommand
 */

export enum TaskCommandName {
	StartNewTask = "StartNewTask",
}

export const taskCommandSchema = z.discriminatedUnion("commandName", [
	z.object({
		commandName: z.literal(TaskCommandName.StartNewTask),
		data: z.object({
			text: z.string(),
			images: z.array(z.string()).optional(),
		}),
	}),
])

export type TaskCommand = z.infer<typeof taskCommandSchema>

/**
 * IpcMessage
 */

export enum IpcMessageType {
	Ack = "Ack",
	TaskCommand = "TaskCommand",
	TaskEvent = "TaskEvent",
}

export enum IpcOrigin {
	Client = "client",
	Server = "server",
	Relay = "relay",
}

export const ipcMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(IpcMessageType.Ack),
		origin: z.literal(IpcOrigin.Server),
		data: z.object({ clientId: z.string() }),
	}),
	z.object({
		type: z.literal(IpcMessageType.TaskCommand),
		origin: z.literal(IpcOrigin.Client),
		clientId: z.string(),
		data: taskCommandSchema,
	}),
	z.object({
		type: z.literal(IpcMessageType.TaskEvent),
		origin: z.union([z.literal(IpcOrigin.Server), z.literal(IpcOrigin.Relay)]),
		relayClientId: z.string().optional(),
		data: taskEventSchema,
	}),
])

export type IpcMessage = z.infer<typeof ipcMessageSchema>
