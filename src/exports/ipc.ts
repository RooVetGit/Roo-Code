import EventEmitter from "node:events"
import { Socket } from "node:net"
import * as crypto from "node:crypto"

import ipc from "node-ipc"
import { z } from "zod"

import { tokenUsageSchema } from "../schemas"

/**
 * TaskEvent
 */

// export interface RooCodeEvents {
// 	message: [{ taskId: string; action: "created" | "updated"; message: ClineMessage }]
// 	taskCreated: [taskId: string]
// 	taskStarted: [taskId: string]
// 	taskPaused: [taskId: string]
// 	taskUnpaused: [taskId: string]
// 	taskAskResponded: [taskId: string]
// 	taskAborted: [taskId: string]
// 	taskSpawned: [taskId: string, childTaskId: string]
// 	taskCompleted: [taskId: string, usage: TokenUsage]
// 	taskTokenUsageUpdated: [taskId: string, usage: TokenUsage]
// }

export enum TaskEventName {
	// Connect = "connect",
	Message = "message",
	TaskCreated = "taskCreated",
	TaskStarted = "taskStarted",
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskAskResponded = "taskAskResponded",
	TaskAborted = "taskAborted",
	TaskSpawned = "taskSpawned",
	TaskCompleted = "taskCompleted",
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
	// TaskFinished = "taskFinished",
}

export const taskEventSchema = z.discriminatedUnion("eventName", [
	// z.object({
	// 	eventName: z.literal(TaskEventName.Connect),
	// 	data: z.object({ taskId: z.string() }),
	// }),
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
		eventName: z.literal(TaskEventName.TaskCreated),
		data: z.object({ taskId: z.string() }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskStarted),
		data: z.object({ taskId: z.string() }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskPaused),
		data: z.object({ taskId: z.string() }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskUnpaused),
		data: z.object({ taskId: z.string() }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskAskResponded),
		data: z.object({ taskId: z.string() }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskAborted),
		data: z.object({ taskId: z.string() }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskSpawned),
		data: z.object({ taskId: z.string(), childTaskId: z.string() }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskCompleted),
		data: z.object({ taskId: z.string(), usage: tokenUsageSchema }),
	}),
	z.object({
		eventName: z.literal(TaskEventName.TaskTokenUsageUpdated),
		data: z.object({ taskId: z.string(), usage: tokenUsageSchema }),
	}),
	// z.object({
	// 	eventName: z.literal(TaskEventName.TaskFinished),
	// 	data: z.object({ task: z.object({ id: z.number() }), taskMetrics: z.unknown() }),
	// }),
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

/**
 * IpcServer
 */

type IpcServerEvents = {
	connect: [clientId: string]
	disconnect: [clientId: string]
	taskCommand: [clientId: string, data: TaskCommand]
	taskEvent: [relayClientId: string | undefined, data: TaskEvent]
}

export class IpcServer extends EventEmitter<IpcServerEvents> {
	private readonly _socketPath: string
	private readonly _log: (...args: unknown[]) => void
	private readonly _clients: Map<string, Socket>

	private _isListening = false

	constructor(socketPath: string, log = console.log) {
		super()

		this._socketPath = socketPath
		this._log = log
		this._clients = new Map()
	}

	public listen() {
		this._isListening = true

		ipc.config.silent = true

		ipc.serve(this.socketPath, () => {
			ipc.server.on("connect", (socket) => this.onConnect(socket))
			ipc.server.on("socket.disconnected", (socket) => this.onDisconnect(socket))
			ipc.server.on("message", (data) => this.onMessage(data))
		})

		ipc.server.start()
	}

	private onConnect(socket: Socket) {
		const clientId = crypto.randomBytes(6).toString("hex")
		this._clients.set(clientId, socket)
		this.log(`[server#onConnect] clientId = ${clientId}, # clients = ${this._clients.size}`)
		this.send(socket, { type: IpcMessageType.Ack, origin: IpcOrigin.Server, data: { clientId } })
		this.emit("connect", clientId)
	}

	private onDisconnect(destroyedSocket: Socket) {
		let disconnectedClientId: string | undefined

		for (const [clientId, socket] of this._clients.entries()) {
			if (socket === destroyedSocket) {
				disconnectedClientId = clientId
				this._clients.delete(clientId)
				break
			}
		}

		this.log(`[server#socket.disconnected] clientId = ${disconnectedClientId}, # clients = ${this._clients.size}`)

		if (disconnectedClientId) {
			this.emit("disconnect", disconnectedClientId)
		}
	}

	private onMessage(data: unknown) {
		if (typeof data !== "object") {
			this.log("[server#onMessage] invalid data", data)
			return
		}

		const result = ipcMessageSchema.safeParse(data)

		if (!result.success) {
			this.log("[server#onMessage] invalid payload", result.error)
			return
		}

		const payload = result.data

		if (payload.origin === IpcOrigin.Client) {
			switch (payload.type) {
				case IpcMessageType.TaskCommand:
					this.emit("taskCommand", payload.clientId, payload.data)
					break
			}
		} else if (payload.origin === IpcOrigin.Relay) {
			switch (payload.type) {
				case IpcMessageType.TaskEvent:
					this.emit("taskEvent", payload.relayClientId, payload.data)
					break
			}
		}
	}

	private log(...args: unknown[]) {
		this._log(...args)
	}

	public broadcast(message: IpcMessage) {
		this.log("[server#broadcast] message =", message)
		ipc.server.broadcast("message", message)
	}

	public send(client: string | Socket, message: IpcMessage) {
		this.log("[server#send] message =", message)

		if (typeof client === "string") {
			const socket = this._clients.get(client)

			if (socket) {
				ipc.server.emit(socket, "message", message)
			}
		} else {
			ipc.server.emit(client, "message", message)
		}
	}

	public get socketPath() {
		return this._socketPath
	}

	public get isListening() {
		return this._isListening
	}
}
