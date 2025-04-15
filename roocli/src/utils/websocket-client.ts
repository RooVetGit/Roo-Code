import chalk from "chalk"
import { EventEmitter } from "events"
import ora from "ora"
import WebSocket from "ws"

interface WebSocketMessage {
	message_id: string
	type: "method_call" | "event" | "authentication" | "error"
	payload: any
}

interface WebSocketResponse {
	message_id: string
	type: string
	payload: any
}

export class WebSocketClient extends EventEmitter {
	private ws: WebSocket | null = null
	private url: string
	private token: string | null = null
	private messageCounter: number = 0
	private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map()
	private connected: boolean = false
	private spinner: any = null

	constructor(url: string, token: string | null = null) {
		super()
		this.url = url
		this.token = token
	}

	/**
	 * Connect to the WebSocket server
	 */
	public connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.spinner = ora("Connecting to RooCode...").start()

				this.ws = new WebSocket(this.url)

				this.ws.on("open", async () => {
					// If we have a token, authenticate with the server
					if (this.token) {
						try {
							await this.authenticate(this.token)
							this.connected = true
							this.spinner.succeed("Connected and authenticated to RooCode")
							resolve()
						} catch (error) {
							this.spinner.fail(
								`Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
							)
							this.ws?.close()
							reject(error)
						}
					} else {
						this.connected = true
						this.spinner.succeed("Connected to RooCode")
						resolve()
					}
				})

				this.ws.on("message", (data: WebSocket.Data) => {
					this.handleMessage(data)
				})

				this.ws.on("error", (error) => {
					this.spinner.fail(`Connection error: ${error.message}`)
					reject(error)
				})

				this.ws.on("close", () => {
					this.connected = false
					if (this.spinner) {
						this.spinner.stop()
					}
					this.emit("disconnected")
				})

				// Set a timeout for the connection
				setTimeout(() => {
					if (!this.connected) {
						this.spinner.fail("Connection timeout")
						reject(new Error("Connection timeout"))
					}
				}, 5000)
			} catch (error) {
				if (this.spinner) {
					this.spinner.fail(`Connection error: ${error instanceof Error ? error.message : String(error)}`)
				}
				reject(error)
			}
		})
	}

	/**
	 * Disconnect from the WebSocket server
	 */
	public disconnect(): void {
		if (this.ws) {
			this.ws.close()
			this.ws = null
		}
	}

	/**
	 * Send a command to the WebSocket server
	 * @param method The method to call
	 * @param params The parameters to pass to the method
	 * @returns A promise that resolves with the result of the command
	 */
	public sendCommand<T = any>(method: string, params: any = {}): Promise<T> {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error("WebSocket is not connected"))
				return
			}

			// Convert params to an array if it's an object
			// The server expects args to be an array, not an object
			const args = Array.isArray(params) ? params : [params]

			console.log(`Sending command ${method} with args:`, JSON.stringify(args))

			const id = String(++this.messageCounter)
			const message = {
				message_id: id,
				type: "method_call",
				payload: {
					method,
					args: args,
				},
			}

			this.pendingRequests.set(id, { resolve, reject })
			this.ws.send(JSON.stringify(message))
		})
	}

	/**
	 * Authenticate with the WebSocket server
	 * @param token The authentication token
	 * @returns A promise that resolves when authentication is successful
	 */
	private authenticate(token: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error("WebSocket is not connected"))
				return
			}

			const id = String(++this.messageCounter)
			const message = {
				message_id: id,
				type: "authentication",
				payload: {
					token,
				},
			}

			this.pendingRequests.set(id, {
				resolve: () => resolve(),
				reject,
			})

			this.ws.send(JSON.stringify(message))
		})
	}

	/**
	 * Handle incoming messages from the WebSocket server
	 * @param data The message data
	 */
	private handleMessage(data: WebSocket.Data): void {
		try {
			const message = JSON.parse(data.toString())

			// Handle command responses
			if (message.message_id && this.pendingRequests.has(message.message_id)) {
				const { resolve, reject } = this.pendingRequests.get(message.message_id)!
				this.pendingRequests.delete(message.message_id)

				if (message.type === "error") {
					reject(new Error(message.payload.message))
				} else {
					resolve(message.payload)
				}
				return
			}

			// Handle events
			if (message.type === "event" && message.payload && message.payload.event) {
				this.emit(message.payload.event, message.payload.data)
				return
			}

			// Handle unknown messages
			console.log(chalk.yellow("Received unknown message:"), message)
		} catch (error) {
			console.error(chalk.red("Error parsing message:"), error)
		}
	}

	/**
	 * Check if the WebSocket is connected
	 */
	public isConnected(): boolean {
		return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN
	}
}
