export interface WebviewMessage {
  type: string
  text?: string
  [key: string]: any
}

export interface CommunicationHandler {
  send(message: WebviewMessage): void
  getState(): unknown | undefined
  setState<T>(state: T): T
  close(): void
}

export interface WebSocketConfig {
  mode: "websocket"
  wsUrl: string
}

export interface RestConfig {
  mode: "rest"
  restUrl: string
  pollingInterval: number
}

export interface VSCodeConfig {
  mode: "vscode"
}

export type CommunicationConfig = WebSocketConfig | RestConfig | VSCodeConfig

export interface MessageCallback {
  (message: WebviewMessage): void
}

export interface CommunicationFactory {
  configure(config: CommunicationConfig): void
  getHandler(): CommunicationHandler
}

export interface CommunicationOptions {
  mode: "websocket" | "rest" | "vscode"
  wsUrl?: string
  restUrl?: string
  pollingInterval?: number
}

// Factory関数の型定義
export function createCommunicationConfig(options: CommunicationOptions): CommunicationConfig {
  switch (options.mode) {
    case "websocket":
      if (!options.wsUrl) {
        throw new Error("WebSocket URL is required for websocket mode")
      }
      return {
        mode: "websocket",
        wsUrl: options.wsUrl,
      }
    case "rest":
      if (!options.restUrl) {
        throw new Error("REST URL is required for rest mode")
      }
      return {
        mode: "rest",
        restUrl: options.restUrl,
        pollingInterval: options.pollingInterval || 1000,
      }
    case "vscode":
      return {
        mode: "vscode",
      }
    default:
      throw new Error(`Unsupported communication mode: ${options.mode}`)
  }
}