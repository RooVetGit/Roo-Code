import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// Mock crypto.getRandomValues
Object.defineProperty(window, "crypto", {
	value: {
		getRandomValues: function (buffer: Uint8Array) {
			for (let i = 0; i < buffer.length; i++) {
				buffer[i] = Math.floor(Math.random() * 256)
			}
			return buffer
		},
	},
})

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})
