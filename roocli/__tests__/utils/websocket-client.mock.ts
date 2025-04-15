import { EventEmitter } from "events"

/**
 * Mock implementation of the WebSocketClient for testing
 */
export class MockWebSocketClient extends EventEmitter {
	private connected: boolean = false
	private mockResponses: Map<string, any> = new Map()
	private mockErrors: Map<string, Error> = new Map()

	/**
	 * Set up a mock response for a specific command
	 * @param method The command method
	 * @param response The response to return
	 */
	public setMockResponse(method: string, response: any): void {
		this.mockResponses.set(method, response)
	}

	/**
	 * Set up a mock error for a specific command
	 * @param method The command method
	 * @param error The error to throw
	 */
	public setMockError(method: string, error: Error): void {
		this.mockErrors.set(method, error)
	}

	/**
	 * Mock connect method
	 */
	public connect(): Promise<void> {
		return new Promise((resolve) => {
			this.connected = true
			resolve()
		})
	}

	/**
	 * Mock disconnect method
	 */
	public disconnect(): void {
		this.connected = false
	}

	/**
	 * Mock sendCommand method
	 * @param method The method to call
	 * @param params The parameters to pass to the method
	 * @returns A promise that resolves with the mock response or rejects with the mock error
	 */
	public sendCommand<T = any>(method: string, params: any = {}): Promise<T> {
		return new Promise((resolve, reject) => {
			if (!this.connected) {
				reject(new Error("WebSocket is not connected"))
				return
			}

			if (this.mockErrors.has(method)) {
				reject(this.mockErrors.get(method))
				return
			}

			if (this.mockResponses.has(method)) {
				resolve(this.mockResponses.get(method))
				return
			}

			// Default response if no mock is set up
			resolve({} as T)
		})
	}

	/**
	 * Mock isConnected method
	 */
	public isConnected(): boolean {
		return this.connected
	}

	/**
	 * Reset all mock responses and errors
	 */
	public resetMocks(): void {
		this.mockResponses.clear()
		this.mockErrors.clear()
	}
}
