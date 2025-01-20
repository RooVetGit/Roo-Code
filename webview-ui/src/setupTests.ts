// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
import "@testing-library/jest-dom"
import "jest-canvas-mock"

// Fix for requestAnimationFrame
global.requestAnimationFrame = (callback) => setTimeout(callback, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)

// Mock IntersectionObserver
class IntersectionObserver {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserver,
})

// Mock ResizeObserver
class ResizeObserver {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserver,
})

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock WebSocket
class WebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = WebSocket.CONNECTING
  url: string

  constructor(url: string) {
    this.url = url
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      if (this.onopen) this.onopen(new Event("open"))
    }, 0)
  }

  send = jest.fn()
  close = jest.fn()
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
}

Object.defineProperty(global, "WebSocket", {
  writable: true,
  value: WebSocket,
})

// Mock fetch
global.fetch = jest.fn()

// Extend expect matchers
expect.extend({
  toBeWebSocketMessage(received: any) {
    const pass = received && typeof received.type === "string"
    return {
      message: () =>
        `expected ${received} to be a valid WebSocket message with a type property`,
      pass,
    }
  },
})

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})
