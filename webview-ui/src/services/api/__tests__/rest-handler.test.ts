import { RestHandler } from "../rest-handler"
import { WebviewMessage, MessageCallback } from "../types"

describe("RestHandler", () => {
  let handler: RestHandler
  let mockFetch: jest.Mock
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation()
    mockFetch = jest.fn()
    global.fetch = mockFetch
    handler = new RestHandler("http://test", 1000)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    jest.clearAllMocks()
    handler.close()
  })

  it("should send messages via POST request", async () => {
    const message: WebviewMessage = {
      type: "test",
      text: "test message",
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    await handler.send(message)

    expect(mockFetch).toHaveBeenCalledWith("http://test/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    })
  })

  it("should handle send errors", async () => {
    const message: WebviewMessage = {
      type: "test",
      text: "test message",
    }

    const error = new Error("Network error")
    mockFetch.mockRejectedValueOnce(error)

    await handler.send(message)

    expect(consoleSpy).toHaveBeenCalledWith("メッセージ送信エラー:", error)
  })

  it("should receive messages through polling", async () => {
    const messages = [
      { type: "test1", text: "message1" },
      { type: "test2", text: "message2" },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(messages),
    })

    const callback = jest.fn()
    handler.onMessage(callback)

    // ポーリングの最初のサイクルを待つ
    await Promise.resolve() // JSONパースのPromiseを解決

    expect(mockFetch).toHaveBeenCalledWith("http://test/messages")
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenNthCalledWith(1, messages[0])
    expect(callback).toHaveBeenNthCalledWith(2, messages[1])
  })

  it("should handle polling errors", async () => {
    const error = new Error("Network error")
    mockFetch.mockRejectedValueOnce(error)

    const callback = jest.fn()
    handler.onMessage(callback)

    // エラーのPromiseを解決
    await Promise.resolve()

    expect(consoleSpy).toHaveBeenCalledWith(
      "メッセージ取得エラー:",
      expect.any(Error)
    )
  })

  it("should handle non-OK response during polling", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    })

    const callback = jest.fn()
    handler.onMessage(callback)

    await Promise.resolve()

    expect(consoleSpy).toHaveBeenCalledWith(
      "メッセージ取得エラー:",
      expect.any(Error)
    )
  })

  it("should stop polling when closed", () => {
    const callback = jest.fn()
    handler.onMessage(callback)
    handler.close()

    expect(mockFetch).not.toHaveBeenCalled()
  })
})