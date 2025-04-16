import { EventEmitter } from "events"
export declare enum EventName {
	Message = "message",
	TaskCreated = "taskCreated",
	TaskStarted = "taskStarted",
	TaskModeSwitched = "taskModeSwitched",
	TaskPaused = "taskPaused",
	TaskUnpaused = "taskUnpaused",
	TaskAskResponded = "taskAskResponded",
	TaskAborted = "taskAborted",
	TaskSpawned = "taskSpawned",
	TaskCompleted = "taskCompleted",
	TaskTokenUsageUpdated = "taskTokenUsageUpdated",
}
export declare class WebSocketClient extends EventEmitter {
	private ws
	private url
	private token
	private messageCounter
	private pendingRequests
	private connected
	private spinner
	private partialMessages
	private activeTaskId
	private connectionTimeoutId
	private debugMode
	private lastActivityTime
	constructor(url: string, token?: string | null, debug?: boolean)
	/**
	 * Connect to the WebSocket server
	 */
	connect(): Promise<void>
	/**
	 * Disconnect from the WebSocket server
	 */
	disconnect(): void
	/**
	 * Send a command to the WebSocket server
	 * @param method The method to call
	 * @param params The parameters to pass to the method
	 * @returns A promise that resolves with the result of the command
	 */
	sendCommand<T = any>(method: string, params?: any): Promise<T>
	/**
	 * Authenticate with the WebSocket server
	 * @param token The authentication token
	 * @returns A promise that resolves when authentication is successful
	 */
	private authenticate
	/**
	 * Handle incoming messages from the WebSocket server
	 * @param data The message data
	 */
	private handleMessage
	/**
	 * Remove all event listeners for a specific task
	 * This prevents memory leaks and ensures that event listeners from previous tasks
	 * don't interfere with new tasks
	 */
	removeTaskEventListeners(): void
	/**
	 * Handle partial message updates from the WebSocket server
	 * @param messageData The message data array
	 */
	private handlePartialMessageUpdates
	/**
	 * Check if the WebSocket is connected
	 */
	isConnected(): boolean
	/**
	 * Subscribe to an event
	 * @param event The event to subscribe to
	 * @returns A promise that resolves when the subscription is successful
	 */
	subscribeToEvent(event: string): Promise<void>
	/**
	 * Subscribe to all events for a specific task
	 * @param taskId The ID of the task to subscribe to
	 */
	subscribeToTaskEvents(taskId: string): Promise<void>
	/**
	 * Get the time since the last activity
	 * @returns Time in milliseconds since the last activity
	 */
	getTimeSinceLastActivity(): number
	/**
	 * Reset the last activity time
	 */
	resetLastActivityTime(): void
	/**
	 * Get the debug mode status
	 * @returns Whether debug mode is enabled
	 */
	isDebugMode(): boolean
}
