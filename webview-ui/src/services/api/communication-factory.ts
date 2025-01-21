import { WebSocketHandler } from './websocket-handler'
import { RestHandler } from './rest-handler'
import { CommunicationConfig } from './types'

export type CommunicationHandler = WebSocketHandler | RestHandler

export class CommunicationFactory {
  private static instance: CommunicationFactory | null = null
  private currentHandler: CommunicationHandler | null = null
  private config: CommunicationConfig | null = null

  private constructor() {}

  public static getInstance(): CommunicationFactory {
    if (!CommunicationFactory.instance) {
      CommunicationFactory.instance = new CommunicationFactory()
    }
    return CommunicationFactory.instance
  }

  public configure(config: CommunicationConfig): void {
    this.config = config
    this.initializeHandler()
  }

  public getHandler<T extends CommunicationHandler>(): T {
    if (!this.currentHandler) {
      if (!this.config) {
        throw new Error('Communication not configured')
      }
      this.initializeHandler()
    }
    return this.currentHandler as T
  }

  private initializeHandler(): void {
    if (!this.config) {
      throw new Error('Configuration is required')
    }

    switch (this.config.mode) {
      case 'websocket':
        if (!this.config.wsUrl) {
          throw new Error('WebSocket URL is required')
        }
        this.currentHandler = new WebSocketHandler(this.config.wsUrl)
        break

      case 'rest':
        if (!this.config.restUrl) {
          throw new Error('REST API URL is required')
        }
        this.currentHandler = new RestHandler(
          this.config.restUrl,
          this.config.pollingInterval
        )
        break

      case 'vscode':
        if (typeof acquireVsCodeApi === 'function') {
          const vscode = acquireVsCodeApi()
          this.currentHandler = {
            send: (message: any) => {
              vscode.postMessage(message)
              return Promise.resolve()
            },
            onMessage: (callback: (message: any) => void) => {
              window.addEventListener('message', (event) => {
                callback(event.data)
              })
            },
          } as CommunicationHandler
        } else {
          console.warn('VSCode API not available')
          this.currentHandler = {
            send: (message: any) => {
              console.log('Mock message sent:', message)
              return Promise.resolve()
            },
            onMessage: () => {
              console.log('Mock onMessage registered')
            },
          }
        }
        break

      default:
        throw new Error(`Unsupported communication mode: ${this.config.mode}`)
    }
  }
}