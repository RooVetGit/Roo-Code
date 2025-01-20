import { CommunicationFactory } from "../communication-factory"
import { WebSocketHandler } from "../websocket-handler"
import { RestHandler } from "../rest-handler"

describe("CommunicationFactory", () => {
  let factory: CommunicationFactory

  beforeEach(() => {
    // Reset singleton instance before each test
    CommunicationFactory.resetInstance()
    factory = CommunicationFactory.getInstance()
  })

  afterEach(() => {
    const handler = factory.getHandler()
    if ("close" in handler) {
      (handler as WebSocketHandler | RestHandler).close()
    }
  })

  it("should create a singleton instance", () => {
    const instance1 = CommunicationFactory.getInstance()
    const instance2 = CommunicationFactory.getInstance()
    expect(instance1).toBe(instance2)
  })

  describe("Mode Selection", () => {
    it("should create WebSocket handler when mode is websocket", () => {
      factory.configure({ mode: "websocket", wsUrl: "ws://test" })
      const handler = factory.getHandler()
      expect(handler).toBeInstanceOf(WebSocketHandler)
    })

    it("should create REST handler when mode is rest", () => {
      // 正しいモードを設定
      factory.configure({ mode: "rest", restUrl: "http://test" })
      const handler = factory.getHandler()
      expect(handler).toBeInstanceOf(RestHandler)
    })

    it("should use environment variable for mode selection", () => {
      const originalEnv = process.env.COMMUNICATION_MODE
      process.env.COMMUNICATION_MODE = "websocket"
      const handler = factory.getHandler()
      expect(handler).toBeInstanceOf(WebSocketHandler)
      process.env.COMMUNICATION_MODE = originalEnv
    })

    it("should fallback to WebSocket when VSCode API is not available", () => {
      factory.configure({ mode: "vscode" })
      const handler = factory.getHandler()
      expect(handler).toBeInstanceOf(WebSocketHandler)
    })
  })

  describe("Configuration", () => {
    it("should apply configuration options", () => {
      const config = {
        mode: "rest" as const,
        restUrl: "http://test",
        pollingInterval: 2000,
      }
      factory.configure(config)
      
      // 新しいインスタンスを取得して型をチェック
      CommunicationFactory.resetInstance()
      const newFactory = CommunicationFactory.getInstance()
      newFactory.configure(config)
      const handler = newFactory.getHandler()
      expect(handler).toBeInstanceOf(RestHandler)
    })

    it("should merge new configuration with existing", () => {
      factory.configure({ mode: "rest", restUrl: "http://test1" })
      factory.configure({ restUrl: "http://test2" })
      
      // 新しいインスタンスを取得して型をチェック
      const handler = factory.getHandler()
      expect(handler).toBeInstanceOf(RestHandler)
    })
  })

  describe("Handler Management", () => {
    it("should reuse existing handler instance", () => {
      factory.configure({ mode: "websocket", wsUrl: "ws://test" })
      const handler1 = factory.getHandler()
      const handler2 = factory.getHandler()
      expect(handler1).toBe(handler2)
    })

    it("should close existing handler when configuration changes", () => {
      factory.configure({ mode: "websocket", wsUrl: "ws://test" })
      const handler = factory.getHandler() as WebSocketHandler
      const closeSpy = jest.spyOn(handler, "close")

      factory.configure({ mode: "rest", restUrl: "http://test" })

      expect(closeSpy).toHaveBeenCalled()
    })
  })

  describe("Error Handling", () => {
    it("should handle invalid mode gracefully", () => {
      factory.configure({ mode: "invalid" as any })
      const handler = factory.getHandler()
      // Should fallback to default (WebSocket in non-VSCode environment)
      expect(handler).toBeInstanceOf(WebSocketHandler)
    })

    it("should handle missing configuration gracefully", () => {
      factory.configure({})
      const handler = factory.getHandler()
      expect(handler).toBeDefined()
    })
  })

  describe("Instance Reset", () => {
    it("should create new instance after reset", () => {
      const instance1 = CommunicationFactory.getInstance()
      CommunicationFactory.resetInstance()
      const instance2 = CommunicationFactory.getInstance()
      expect(instance1).not.toBe(instance2)
    })

    it("should close handler when resetting instance", () => {
      factory.configure({ mode: "websocket", wsUrl: "ws://test" })
      const handler = factory.getHandler() as WebSocketHandler
      const closeSpy = jest.spyOn(handler, "close")

      CommunicationFactory.resetInstance()

      expect(closeSpy).toHaveBeenCalled()
    })
  })
})