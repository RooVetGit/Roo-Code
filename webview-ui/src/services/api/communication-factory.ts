import { WebSocketHandler } from "./websocket-handler"
import { RestHandler } from "./rest-handler"
import {
  CommunicationHandler,
  CommunicationConfig,
  WebSocketConfig,
  RestConfig,
  VSCodeConfig,
} from "./types"

export class CommunicationFactory {
  private static instance: CommunicationFactory
  private handler?: CommunicationHandler
  private config?: CommunicationConfig

  private constructor() {}

  public static getInstance(): CommunicationFactory {
    if (!CommunicationFactory.instance) {
      CommunicationFactory.instance = new CommunicationFactory()
    }
    return CommunicationFactory.instance
  }

  public static resetInstance(): void {
    if (CommunicationFactory.instance?.handler) {
      CommunicationFactory.instance.handler.close()
    }
    CommunicationFactory.instance = new CommunicationFactory()
  }

  public configure(config: CommunicationConfig): void {
    this.config = config
    if (this.handler) {
      this.handler.close()
    }

    switch (config.mode) {
      case "websocket":
        this.configureWebSocket(config)
        break
      case "rest":
        this.configureRest(config)
        break
      case "vscode":
        this.configureVSCode(config)
        break
      default:
        throw new Error(`Unsupported communication mode: ${config}`)
    }
  }

  private configureWebSocket(config: WebSocketConfig): void {
    this.handler = new WebSocketHandler(config.wsUrl)
  }

  private configureRest(config: RestConfig): void {
    this.handler = new RestHandler(config.restUrl, config.pollingInterval)
  }

  private configureVSCode(config: VSCodeConfig): void {
    const vscode = acquireVsCodeApi()
    this.handler = {
      send: (message) => vscode.postMessage(message),
      getState: () => vscode.getState(),
      setState: (state) => vscode.setState(state),
      close: () => {},
    }
  }

  public getHandler(): CommunicationHandler {
    if (!this.handler) {
      throw new Error("Communication handler not configured")
    }
    return this.handler
  }
}