import { WebSocketHandler } from "../websocket-handler"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"

describe("WebSocketHandler", () => {
  let handler: WebSocketHandler
  let mockWebSocket: any
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation()
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      readyState: WebSocket.OPEN,
    }
    ;(global as any).WebSocket = jest.fn(() => mockWebSocket)
    handler = new WebSocketHandler("ws://test")
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    jest.clearAllMocks()
  })

  it("should initialize with correct URL", () => {
    expect(global.WebSocket).toHaveBeenCalledWith("ws://test")
  })

  it("should handle sending message when WebSocket is connected", () => {
    const message: WebviewMessage = {
      type: "test",
      text: "test message",
    }

    handler.send(message)
    expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message))
  })

  it("should handle sending message when WebSocket is not connected", () => {
    mockWebSocket.readyState = WebSocket.CLOSED
    const message: WebviewMessage = {
      type: "test",
      text: "test message",
    }

    handler.send(message)
    expect(consoleSpy).toHaveBeenCalledWith("WebSocket接続が確立されていません")
  })

  it("should handle receiving messages", () => {
    const callback = jest.fn()
    handler.onMessage(callback)

    // WebSocketのメッセージイベントをシミュレート
    const messageEvent = new MessageEvent("message", {
      data: JSON.stringify({ type: "test", text: "received message" }),
    })
    const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
      (call) => call[0] === "message"
    )[1]
    messageHandler(messageEvent)

    expect(callback).toHaveBeenCalledWith({
      type: "test",
      text: "received message",
    })
  })

  it("should handle connection errors", () => {
    const errorHandler = mockWebSocket.addEventListener.mock.calls.find(
      (call) => call[0] === "error"
    )[1]
    errorHandler(new Event("error"))

    expect(consoleSpy).toHaveBeenCalledWith(
      "WebSocket接続エラー:",
      expect.any(Event)
    )
  })

  it("should handle connection close", () => {
    const closeHandler = mockWebSocket.addEventListener.mock.calls.find(
      (call) => call[0] === "close"
    )[1]
    closeHandler(new CloseEvent("close"))

    expect(consoleSpy).toHaveBeenCalledWith(
      "WebSocket接続が閉じられました:",
      expect.any(CloseEvent)
    )
  })

  it("should close WebSocket connection", () => {
    handler.close()
    expect(mockWebSocket.close).toHaveBeenCalled()
  })
})