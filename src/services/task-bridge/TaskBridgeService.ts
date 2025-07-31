import Redis from "ioredis"
import { z } from "zod"

import { type TaskEvents, type TaskEventHandlers, Task } from "../../core/task/Task"

const NAMESPACE = "bridge"

export interface TaskBridgeConfig {
	url?: string
	namespace?: string
	reconnectOnError?: boolean
	maxReconnectAttempts?: number
	reconnectDelay?: number
}

const taskBridgeMessageTypes = ["message_queued", "task_status", "task_event"] as const

type TaskBridgeMessageType = (typeof taskBridgeMessageTypes)[number]

const taskBridgeMessagePayloadSchema = z.object({
	eventType: z.string(),
	data: z.record(z.string(), z.unknown()),
})

type TaskBridgeMessagePayload = z.infer<typeof taskBridgeMessagePayloadSchema>

const taskBridgeMessageSchema = z.object({
	taskId: z.string(),
	type: z.enum(taskBridgeMessageTypes),
	payload: taskBridgeMessagePayloadSchema,
	timestamp: z.number(),
})

export type TaskBridgeMessage = z.infer<typeof taskBridgeMessageSchema>

export interface QueuedMessage {
	text: string
	images?: string[]
	timestamp: number
}

export class TaskBridgeService {
	private static instance: TaskBridgeService | null = null

	private config: TaskBridgeConfig
	private publisher: Redis | null = null
	private subscriber: Redis | null = null
	private isConnected: boolean = false
	private reconnectAttempts: number = 0
	private reconnectTimeout: NodeJS.Timeout | null = null
	private subscribedTasks: Map<string, Task> = new Map()
	private taskEventHandlers: Record<string, Partial<TaskEventHandlers>> = {}

	private constructor({
		url = "redis://localhost:6379",
		namespace = NAMESPACE,
		reconnectOnError = true,
		maxReconnectAttempts = 10,
		reconnectDelay = 5000,
	}: TaskBridgeConfig = {}) {
		this.config = { url, namespace, reconnectOnError, maxReconnectAttempts, reconnectDelay }
	}

	public static getInstance(config?: TaskBridgeConfig) {
		if (!TaskBridgeService.instance) {
			TaskBridgeService.instance = new TaskBridgeService(config)
		}

		return TaskBridgeService.instance
	}

	public async initialize() {
		if (this.isConnected) {
			return
		}

		this.publisher = new Redis(this.config.url!, {
			retryStrategy: (times: number) => {
				if (times > this.config.maxReconnectAttempts!) {
					return null
				}

				return Math.min(times * 50, 2000)
			},
		})

		this.subscriber = new Redis(this.config.url!, {
			retryStrategy: (times: number) => {
				if (times > this.config.maxReconnectAttempts!) {
					return null
				}

				return Math.min(times * 50, 2000)
			},
		})

		this.publisher.on("error", (error: Error) => this.handleConnectionError(error))
		this.publisher.on("close", () => this.handleConnectionError())

		this.subscriber.on("error", (error: Error) => this.handleConnectionError(error))
		this.subscriber.on("close", () => this.handleConnectionError())

		this.subscriber.on("message", (channel: string, buffer: string) => {
			try {
				const message = taskBridgeMessageSchema.parse(JSON.parse(buffer))
				const parts = channel.split(":")
				const taskId = parts[parts.length - 2]
				const task = this.subscribedTasks.get(taskId)

				if (!task) {
					console.warn(`Received message for unsubscribed task: ${taskId}`)
					return
				}

				switch (message.type) {
					case "message_queued":
						console.log(`Received message_queued event for task: ${taskId}`, message.payload)
						break
					case "task_status":
						console.log(`Received task_status event for task: ${taskId}`, message.payload)
						break
					case "task_event":
						console.log(`Received task_event event for task: ${taskId}`, message.payload)
						break
				}
			} catch (error) {
				console.error("Error handling incoming message:", error)
			}
		})

		await Promise.all([this.waitForConnection(this.publisher), this.waitForConnection(this.subscriber)])

		this.isConnected = true
		this.reconnectAttempts = 0

		console.log(`[TaskBridgeService] connected -> ${this.config.url}`)
	}

	public async subscribeToTask(task: Task): Promise<void> {
		if (!this.isConnected || !this.subscriber) {
			throw new Error("TaskBridgeService is not connected")
		}

		this.subscribedTasks.set(task.taskId, task)
		await this.subscriber.subscribe(this.serverChannel(task.taskId))
		this.setupTaskEventListeners(task)
	}

	public async unsubscribeFromTask(taskId: string): Promise<void> {
		if (!this.subscriber) {
			return
		}

		const task = this.subscribedTasks.get(taskId)

		if (task) {
			this.removeTaskEventListeners(task)
			this.subscribedTasks.delete(taskId)
		}

		await this.subscriber.unsubscribe(this.serverChannel(taskId))
	}

	public async publish(taskId: string, type: TaskBridgeMessageType, payload: TaskBridgeMessagePayload) {
		if (!this.isConnected || !this.publisher) {
			throw new Error("TaskBridgeService is not connected")
		}

		const channel = this.clientChannel(taskId)

		const data: TaskBridgeMessage = {
			taskId,
			type,
			payload,
			timestamp: Date.now(),
		}

		console.log(`[TaskBridgeService] publishing to ${channel}`, data)
		await this.publisher.publish(channel, JSON.stringify(data))
	}

	public async disconnect(): Promise<void> {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout)
			this.reconnectTimeout = null
		}

		for (const taskId of this.subscribedTasks.keys()) {
			await this.unsubscribeFromTask(taskId)
		}

		if (this.publisher) {
			await this.publisher.quit()
			this.publisher = null
		}

		if (this.subscriber) {
			await this.subscriber.quit()
			this.subscriber = null
		}

		this.isConnected = false
		TaskBridgeService.instance = null
	}

	public get connected(): boolean {
		return this.isConnected
	}

	public get subscribedTaskCount(): number {
		return this.subscribedTasks.size
	}

	private waitForConnection(client: Redis): Promise<void> {
		return new Promise((resolve, reject) => {
			if (client.status === "ready") {
				resolve()
				return
			}

			const onReady = () => {
				client.off("ready", onReady)
				client.off("error", onError)
				resolve()
			}

			const onError = (error: Error) => {
				client.off("ready", onReady)
				client.off("error", onError)
				reject(error)
			}

			client.once("ready", onReady)
			client.once("error", onError)
		})
	}

	private handleConnectionError(_error?: Error): void {
		this.isConnected = false

		if (!this.config.reconnectOnError) {
			return
		}

		if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
			return
		}

		if (this.reconnectTimeout) {
			return
		}

		this.reconnectAttempts++

		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null
			this.initialize()
		}, this.config.reconnectDelay)
	}

	private setupTaskEventListeners(task: Task) {
		const callbacks: Partial<TaskEventHandlers> = {
			message: ({ action, message }) =>
				this.publish(task.taskId, "task_event", { eventType: "message", data: { action, message } }),
			taskStarted: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "started" } }),
			taskPaused: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "paused" } }),
			taskUnpaused: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "unpaused" } }),
			taskAborted: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "aborted" } }),
			taskCompleted: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "completed" } }),
		}

		this.taskEventHandlers[task.taskId] = callbacks

		for (const [eventName, handler] of Object.entries(callbacks)) {
			task.on(eventName as keyof TaskEvents, handler)
		}
	}

	private removeTaskEventListeners(task: Task): void {
		const handlers = this.taskEventHandlers[task.taskId]

		if (!handlers) {
			return
		}

		for (const [eventName, handler] of Object.entries(handlers)) {
			task.off(eventName as keyof TaskEvents, handler)
		}

		delete this.taskEventHandlers[task.taskId]
	}

	private serverChannel(taskId: string): string {
		return `${this.config.namespace}:${taskId}:server`
	}

	private clientChannel(taskId: string): string {
		return `${this.config.namespace}:${taskId}:client`
	}
}
