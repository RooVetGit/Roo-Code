import { WebviewMessage } from "../../../src/shared/WebviewMessage"
import { CommunicationFactory } from "../services/api/communication-factory"
import { createCommunicationConfig, CommunicationOptions } from "../services/api/types"

/**
 * A utility wrapper around the communication layer, which enables
 * message passing and state management between the webview and server
 * contexts.
 */
class VSCodeAPIWrapper {
  private readonly communicationHandler

  constructor() {
    // Reset any existing instance to ensure clean state
    CommunicationFactory.resetInstance()
    const factory = CommunicationFactory.getInstance()
    
    // 環境に応じた通信ハンドラーを設定
    try {
      if (typeof acquireVsCodeApi === "function") {
        factory.configure(createCommunicationConfig({ mode: "vscode" }))
      } else if (process.env.COMMUNICATION_MODE === "rest") {
        factory.configure(
          createCommunicationConfig({
            mode: "rest",
            restUrl: process.env.REST_API_URL || "http://localhost:3001",
            pollingInterval: parseInt(process.env.POLLING_INTERVAL || "1000", 10),
          })
        )
      } else {
        factory.configure(
          createCommunicationConfig({
            mode: "websocket",
            wsUrl: process.env.WEBSOCKET_URL || "ws://localhost:3001",
          })
        )
      }
    } catch (error) {
      console.error("Failed to configure communication handler:", error)
    }

    // 設定後にハンドラーを取得
    this.communicationHandler = factory.getHandler()
  }

  /**
   * Post a message to the server.
   */
  public postMessage(message: WebviewMessage) {
    if (this.communicationHandler) {
      this.communicationHandler.send(message)
    }
  }

  /**
   * Get the persistent state.
   */
  public getState(): unknown | undefined {
    return this.communicationHandler?.getState()
  }

  /**
   * Set the persistent state.
   */
  public setState<T extends unknown | undefined>(newState: T): T {
    return this.communicationHandler?.setState(newState) ?? newState
  }

  /**
   * Configure the communication settings.
   */
  public static configure(partialConfig: Partial<CommunicationOptions> = {}) {
    try {
      const config: CommunicationOptions = {
        mode: partialConfig.mode || "websocket",
        wsUrl: partialConfig.wsUrl,
        restUrl: partialConfig.restUrl,
        pollingInterval: partialConfig.pollingInterval,
      }

      // Reset any existing instance before configuring
      CommunicationFactory.resetInstance()
      const factory = CommunicationFactory.getInstance()
      factory.configure(createCommunicationConfig(config))
    } catch (error) {
      console.error("Failed to configure VSCode wrapper:", error)
    }
  }

  /**
   * Reset the communication layer.
   */
  public static reset() {
    try {
      CommunicationFactory.resetInstance()
    } catch (error) {
      console.error("Failed to reset VSCode wrapper:", error)
    }
  }
}

// シングルトンインスタンスを作成する前に既存のインスタンスをリセット
try {
  VSCodeAPIWrapper.reset()
} catch (error) {
  console.error("Failed to reset VSCode wrapper:", error)
}

// Exports class singleton to prevent multiple instances
export const vscode = new VSCodeAPIWrapper()

// Allow configuration from the application
export const configureVSCode = VSCodeAPIWrapper.configure

// Allow resetting for testing purposes
export const resetVSCode = VSCodeAPIWrapper.reset
