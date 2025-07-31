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
	connectionTimeout?: number
	commandTimeout?: number
}

const taskBridgeMessageTypes = ["message", "task_event"] as const

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

interface InternalQueuedMessage {
	id: string
	taskId: string
	message: QueuedMessage
	timestamp: number
	retryCount: number
	maxRetries: number
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

	private messageQueues: Map<string, InternalQueuedMessage[]> = new Map()
	private taskStatuses: Map<string, boolean> = new Map()
	private processingQueues: Set<string> = new Set()
	private queueProcessingTimeouts: Map<string, NodeJS.Timeout> = new Map()
	private processingPromises: Map<string, Promise<void>> = new Map()

	private readonly RETRY_DELAY_MS = 1000
	private readonly MAX_RETRY_DELAY_MS = 30000
	private readonly DEFAULT_MAX_RETRIES = 3

	private constructor({
		url = "redis://localhost:6379",
		namespace = NAMESPACE,
		reconnectOnError = true,
		maxReconnectAttempts = 10,
		reconnectDelay = 5000,
		connectionTimeout = 10000,
		commandTimeout = 5000,
	}: TaskBridgeConfig = {}) {
		this.config = {
			url,
			namespace,
			reconnectOnError,
			maxReconnectAttempts,
			reconnectDelay,
			connectionTimeout,
			commandTimeout,
		}
		this.validateConfig()
	}

	public static getInstance(config?: TaskBridgeConfig) {
		if (!TaskBridgeService.instance) {
			TaskBridgeService.instance = new TaskBridgeService(config)
		} else if (config) {
			console.warn("[TaskBridgeService] Instance already exists. Configuration will be ignored.")
		}

		return TaskBridgeService.instance
	}

	public static resetInstance(): void {
		if (TaskBridgeService.instance) {
			TaskBridgeService.instance.disconnect().catch(() => {})
			TaskBridgeService.instance = null
		}
	}

	public async initialize() {
		if (this.isConnected) {
			return
		}

		try {
			this.publisher = new Redis(this.config.url!, {
				retryStrategy: (times: number) => {
					if (times > this.config.maxReconnectAttempts!) {
						return null
					}

					return Math.min(times * 50, 2000)
				},
				enableOfflineQueue: false,
				lazyConnect: true,
				connectTimeout: this.config.connectionTimeout,
				commandTimeout: this.config.commandTimeout,
			})

			this.subscriber = new Redis(this.config.url!, {
				retryStrategy: (times: number) => {
					if (times > this.config.maxReconnectAttempts!) {
						return null
					}

					return Math.min(times * 50, 2000)
				},
				enableOfflineQueue: false,
				lazyConnect: true,
				connectTimeout: this.config.connectionTimeout,
				commandTimeout: this.config.commandTimeout,
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
						case "message":
							console.log(`Received message event for task: ${taskId}`, message.payload)
							this.handleQueuedMessage(taskId, message.payload)
							break
					}
				} catch (error) {
					console.error("Error handling incoming message:", error)
				}
			})

			// Connect explicitly
			await Promise.all([this.publisher.connect(), this.subscriber.connect()])

			await Promise.all([this.waitForConnection(this.publisher), this.waitForConnection(this.subscriber)])

			this.isConnected = true
			this.reconnectAttempts = 0

			console.log(`[TaskBridgeService] connected -> ${this.config.url}`)
		} catch (error) {
			// Clean up on failure
			if (this.publisher) {
				await this.publisher.quit().catch(() => {})
				this.publisher = null
			}
			if (this.subscriber) {
				await this.subscriber.quit().catch(() => {})
				this.subscriber = null
			}
			throw error
		}
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
		// Clear reconnection timeout
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout)
			this.reconnectTimeout = null
		}

		// Clear all queue processing timeouts
		for (const timeoutId of this.queueProcessingTimeouts.values()) {
			clearTimeout(timeoutId)
		}
		this.queueProcessingTimeouts.clear()

		// Wait for all processing to complete
		const processingPromises = Array.from(this.processingPromises.values())
		if (processingPromises.length > 0) {
			await Promise.allSettled(processingPromises)
		}
		this.processingPromises.clear()

		// Unsubscribe from all tasks
		const unsubscribePromises = []
		for (const taskId of this.subscribedTasks.keys()) {
			unsubscribePromises.push(this.unsubscribeFromTask(taskId))
		}
		await Promise.allSettled(unsubscribePromises)

		// Remove event listeners before closing connections
		if (this.publisher) {
			this.publisher.removeAllListeners()
			await this.publisher.quit()
			this.publisher = null
		}

		if (this.subscriber) {
			this.subscriber.removeAllListeners()
			await this.subscriber.quit()
			this.subscriber = null
		}

		// Clear all internal state
		this.messageQueues.clear()
		this.taskStatuses.clear()
		this.processingQueues.clear()
		this.subscribedTasks.clear()
		this.taskEventHandlers = {}

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

	private handleConnectionError(error?: Error): void {
		this.isConnected = false

		// Log the error for debugging
		if (error) {
			console.error("[TaskBridgeService] Connection error:", error.message)
		}

		if (!this.config.reconnectOnError) {
			console.warn("[TaskBridgeService] Reconnection disabled, service will remain disconnected")
			return
		}

		if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
			console.error(`[TaskBridgeService] Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`)
			return
		}

		if (this.reconnectTimeout) {
			return
		}

		this.reconnectAttempts++
		console.log(
			`[TaskBridgeService] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`,
		)

		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null
			this.initialize().catch((err) => {
				console.error("[TaskBridgeService] Reconnection failed:", err)
				this.handleConnectionError(err)
			})
		}, this.config.reconnectDelay)
	}

	private setupTaskEventListeners(task: Task) {
		const callbacks: Partial<TaskEventHandlers> = {
			// message: ({ action, message }) =>
			// 	this.publish(task.taskId, "task_event", { eventType: "message", data: { action, message } }),
			taskStarted: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "started" } }),
			taskPaused: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "paused" } }),
			taskUnpaused: () =>
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "unpaused" } }),
			taskAborted: () => {
				this.cleanupTaskQueue(task.taskId)
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "aborted" } })
			},
			taskCompleted: () => {
				this.cleanupTaskQueue(task.taskId)
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "completed" } })
			},
			taskBusy: (taskId: string) => {
				this.taskStatuses.set(taskId, false)
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "busy" } })
			},
			taskFree: (taskId: string) => {
				this.taskStatuses.set(taskId, true)
				this.processQueueForTask(taskId)
				this.publish(task.taskId, "task_event", { eventType: "status", data: { status: "free" } })
			},
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

	private isTaskReady(taskId: string): boolean {
		return this.taskStatuses.get(taskId) ?? false
	}

	private handleQueuedMessage(taskId: string, payload: TaskBridgeMessagePayload): void {
		const messageData = payload.data as { text?: string; images?: string[] }

		if (!messageData.text) {
			console.warn(`Received queued message without text for task: ${taskId}`)
			return
		}

		const queuedMessage: QueuedMessage = {
			text: messageData.text,
			images: messageData.images,
			timestamp: Date.now(),
		}

		if (this.isTaskReady(taskId)) {
			this.deliverMessage(taskId, queuedMessage)
		} else {
			this.enqueueMessage(taskId, queuedMessage)
		}
	}

	private enqueueMessage(taskId: string, message: QueuedMessage): void {
		const queue = this.messageQueues.get(taskId) || []

		queue.push({
			id: `${taskId}-${Date.now()}-${Math.random()}`,
			taskId,
			message,
			timestamp: Date.now(),
			retryCount: 0,
			maxRetries: this.DEFAULT_MAX_RETRIES,
		})

		this.messageQueues.set(taskId, queue)
		console.log(`Queued message for task ${taskId}. Queue size: ${queue.length}`)
	}

	private async deliverMessage(taskId: string, message: QueuedMessage): Promise<boolean> {
		const task = this.subscribedTasks.get(taskId)

		if (!task) {
			console.warn(`Cannot deliver message: task ${taskId} not found`)
			return false
		}

		try {
			await task.handleWebviewAskResponse("messageResponse", message.text, message.images)
			return true
		} catch (error) {
			console.error(`Failed to deliver message to task ${taskId}:`, error)
			return false
		}
	}

	private async processQueueForTask(taskId: string): Promise<void> {
		// Check if there's already a processing promise for this task.
		const existingPromise = this.processingPromises.get(taskId)

		if (existingPromise) {
			// Wait for the existing processing to complete.
			await existingPromise

			// After existing processing completes, check if we need to process again.
			// This handles the case where new messages arrived during processing.
			if (this.messageQueues.has(taskId) && this.isTaskReady(taskId)) {
				return this.processQueueForTask(taskId)
			}
			return
		}

		// Check if there's actually work to do.
		const queue = this.messageQueues.get(taskId)

		if (!queue || queue.length === 0) {
			return
		}

		// Create and store the processing promise.
		const processingPromise = this._processQueue(taskId)
		this.processingPromises.set(taskId, processingPromise)

		try {
			await processingPromise
		} finally {
			// Clean up the promise reference.
			this.processingPromises.delete(taskId)
		}
	}

	private async _processQueue(taskId: string): Promise<void> {
		const queue = this.messageQueues.get(taskId)

		if (!queue || queue.length === 0) {
			return
		}

		this.processingQueues.add(taskId)

		try {
			while (queue.length > 0 && this.isTaskReady(taskId)) {
				const queuedMessage = queue[0]
				console.log(`Processing queued message for task ${taskId}. Remaining: ${queue.length}`)
				const success = await this.deliverMessage(taskId, queuedMessage.message)

				if (success) {
					queue.shift()
				} else {
					queuedMessage.retryCount++

					if (queuedMessage.retryCount >= queuedMessage.maxRetries) {
						console.error(`Max retries reached for message in task ${taskId}. Removing from queue.`)
						queue.shift()
					} else {
						const delay = Math.min(
							this.RETRY_DELAY_MS * Math.pow(2, queuedMessage.retryCount - 1),
							this.MAX_RETRY_DELAY_MS,
						)

						console.log(`Scheduling retry ${queuedMessage.retryCount} for task ${taskId} in ${delay}ms`)

						const timeoutId = setTimeout(() => {
							this.queueProcessingTimeouts.delete(taskId)
							this.processQueueForTask(taskId)
						}, delay)

						this.queueProcessingTimeouts.set(taskId, timeoutId)
						break
					}
				}
			}

			if (queue.length === 0) {
				this.messageQueues.delete(taskId)
			} else {
				this.messageQueues.set(taskId, queue)
			}
		} finally {
			this.processingQueues.delete(taskId)
		}
	}

	private cleanupTaskQueue(taskId: string): void {
		const timeoutId = this.queueProcessingTimeouts.get(taskId)

		if (timeoutId) {
			clearTimeout(timeoutId)
			this.queueProcessingTimeouts.delete(taskId)
		}

		// Wait for any ongoing processing to complete before cleaning up..
		const processingPromise = this.processingPromises.get(taskId)

		if (processingPromise) {
			// Don't await here to avoid blocking, just delete the reference.
			this.processingPromises.delete(taskId)
		}

		this.processingQueues.delete(taskId)
		this.messageQueues.delete(taskId)
		this.taskStatuses.delete(taskId)
		console.log(`Cleaned up queue for task ${taskId}`)
	}

	private validateConfig(): void {
		if (!this.config.url) {
			throw new Error("[TaskBridgeService] Redis URL is required")
		}

		if (!this.config.namespace || this.config.namespace.trim() === "") {
			throw new Error("[TaskBridgeService] Namespace is required")
		}

		if (this.config.maxReconnectAttempts! < 0) {
			throw new Error("[TaskBridgeService] maxReconnectAttempts must be non-negative")
		}

		if (this.config.reconnectDelay! < 0) {
			throw new Error("[TaskBridgeService] reconnectDelay must be non-negative")
		}

		if (this.config.connectionTimeout! < 0) {
			throw new Error("[TaskBridgeService] connectionTimeout must be non-negative")
		}

		if (this.config.commandTimeout! < 0) {
			throw new Error("[TaskBridgeService] commandTimeout must be non-negative")
		}
	}

	/**
	 * Get the current connection status
	 */
	public getStatus(): {
		connected: boolean
		reconnectAttempts: number
		subscribedTasks: number
		queuedMessages: number
		processingTasks: number
	} {
		let totalQueuedMessages = 0
		for (const queue of this.messageQueues.values()) {
			totalQueuedMessages += queue.length
		}

		return {
			connected: this.isConnected,
			reconnectAttempts: this.reconnectAttempts,
			subscribedTasks: this.subscribedTasks.size,
			queuedMessages: totalQueuedMessages,
			processingTasks: this.processingQueues.size,
		}
	}

	/**
	 * Check if a specific task has queued messages
	 */
	public hasQueuedMessages(taskId: string): boolean {
		const queue = this.messageQueues.get(taskId)
		return queue ? queue.length > 0 : false
	}

	/**
	 * Get the number of queued messages for a specific task
	 */
	public getQueuedMessageCount(taskId: string): number {
		const queue = this.messageQueues.get(taskId)
		return queue ? queue.length : 0
	}
}
