import { vscode, configureVSCode } from "../vscode"
import { CommunicationFactory } from "../../services/api/communication-factory"
import { WebSocketHandler } from "../../services/api/websocket-handler"
import { RestHandler } from "../../services/api/rest-handler"
import { WebviewMessage } from "../../../../src/shared/WebviewMessage"

jest.mock("../../services/api/communication-factory")

describe("VSCodeAPIWrapper", () => {
  let mockHandler: {
    send: jest.Mock
    receive: jest.Mock
    getState: jest.Mock
    setState: jest.Mock
  }

  beforeEach(() => {
    mockHandler = {
      send: jest.fn(),
      receive: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
    }

    ;(CommunicationFactory.getInstance as jest.Mock).mockReturnValue({
      getHandler: jest.fn().mockReturnValue(mockHandler),
      configure: jest.fn(),
    })
  })

  describe("Messaging", () => {
    it("should send messages through communication handler", () => {
      const message: WebviewMessage = {
        type: "newTask",
        text: "test message",
      }

      vscode.postMessage(message)
      expect(mockHandler.send).toHaveBeenCalledWith(message)
    })

    it("should handle different message types", () => {
      const messages: WebviewMessage[] = [
        {
          type: "apiConfiguration",
          text: "API config message",
        },
        {
          type: "clearTask",
          text: "Clear task message",
        },
        {
          type: "customInstructions",
          text: "Custom instructions",
        },
      ]

      messages.forEach(message => {
        vscode.postMessage(message)
        expect(mockHandler.send).toHaveBeenCalledWith(message)
      })
    })
  })

  describe("State Management", () => {
    it("should get state from communication handler", () => {
      const mockState = { data: "test" }
      mockHandler.getState.mockReturnValue(mockState)

      const state = vscode.getState()
      expect(mockHandler.getState).toHaveBeenCalled()
      expect(state).toBe(mockState)
    })

    it("should set state through communication handler", () => {
      const newState = { data: "test" }
      mockHandler.setState.mockReturnValue(newState)

      const result = vscode.setState(newState)
      expect(mockHandler.setState).toHaveBeenCalledWith(newState)
      expect(result).toBe(newState)
    })
  })

  describe("Configuration", () => {
    it("should configure WebSocket mode", () => {
      const config = {
        mode: "websocket" as const,
        wsUrl: "ws://test",
      }
      configureVSCode(config)

      const factoryInstance = CommunicationFactory.getInstance()
      expect(factoryInstance.configure).toHaveBeenCalledWith(config)
    })

    it("should configure REST mode", () => {
      const config = {
        mode: "rest" as const,
        restUrl: "http://test",
        pollingInterval: 1000,
      }
      configureVSCode(config)

      const factoryInstance = CommunicationFactory.getInstance()
      expect(factoryInstance.configure).toHaveBeenCalledWith(config)
    })

    it("should handle missing configuration gracefully", () => {
      configureVSCode({})

      const factoryInstance = CommunicationFactory.getInstance()
      expect(factoryInstance.configure).toHaveBeenCalledWith({})
    })
  })

  describe("Integration Tests", () => {
    beforeEach(() => {
      jest.resetModules()
      jest.unmock("../../services/api/communication-factory")
    })

    it("should work with WebSocket handler", () => {
      configureVSCode({ mode: "websocket", wsUrl: "ws://test" })
      const handler = CommunicationFactory.getInstance().getHandler()
      expect(handler).toBeInstanceOf(WebSocketHandler)
    })

    it("should work with REST handler", () => {
      configureVSCode({ mode: "rest", restUrl: "http://test" })
      const handler = CommunicationFactory.getInstance().getHandler()
      expect(handler).toBeInstanceOf(RestHandler)
    })
  })
})