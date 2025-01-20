import { CommunicationHandler, WebviewMessage, MessageCallback } from "./types"

export class WebSocketHandler implements CommunicationHandler {
  private ws: WebSocket
  private messageCallback?: MessageCallback

  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.setupEventListeners()
  }

  private setupEventListeners() {
    this.ws.addEventListener("message", (event: MessageEvent) => {
      if (this.messageCallback) {
        try {
          const message = JSON.parse(event.data)
          this.messageCallback(message)
        } catch (error) {
          console.error("メッセージのパースエラー:", error)
        }
      }
    })

    this.ws.addEventListener("error", (event: Event) => {
      console.error("WebSocket接続エラー:", event)
    })

    this.ws.addEventListener("close", (event: CloseEvent) => {
      console.error("WebSocket接続が閉じられました:", event)
    })
  }

  public send(message: WebviewMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.error("WebSocket接続が確立されていません")
    }
  }

  public onMessage(callback: MessageCallback): void {
    this.messageCallback = callback
  }

  public getState(): unknown | undefined {
    return undefined
  }

  public setState<T>(state: T): T {
    return state
  }

  public close(): void {
    this.ws.close()
  }
}