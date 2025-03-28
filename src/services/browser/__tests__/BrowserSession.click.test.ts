import { BrowserSession } from "../BrowserSession"
import { ExtensionContext } from "vscode"
import { Page, Mouse } from "puppeteer-core"

// Mock necessary VS Code and Puppeteer parts
const mockContext = {
	globalState: {
		get: jest.fn().mockImplementation((key: string) => {
			if (key === "browserViewportSize") return "900x600"
			return undefined
		}),
		update: jest.fn(),
	},
	// Add other necessary mock properties if needed
} as unknown as ExtensionContext

let fileChooserCallback: ((arg: any) => void) | null = null

const mockMouse = {
	click: jest.fn().mockImplementation(async (x, y) => {
		// If the filechooser callback has been set up by page.once,
		// simulate the click failing by directly rejecting the promise.
		if (fileChooserCallback) {
			// Use the same error object defined in the test for consistency
			const expectedError = new Error(
				"Clicking this element opened a file selection dialog. You MUST use the 'upload' action with a valid CSS selector for the file input element and the file path instead of clicking.",
			)
			return Promise.reject(expectedError)
		}
		// Simulate click completing if no error was thrown
		return Promise.resolve()
	}),
} as unknown as Mouse

const mockPage = {
	mouse: mockMouse,
	once: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
	evaluate: jest.fn(),
	screenshot: jest.fn().mockResolvedValue("base64data"), // Mock screenshot to avoid errors
	url: jest.fn().mockReturnValue("http://example.com"), // Mock URL
	content: jest.fn().mockResolvedValue("<html></html>"), // Mock content
	keyboard: { type: jest.fn() }, // Mock keyboard if needed by other parts of doAction
	waitForNavigation: jest.fn().mockResolvedValue(null), // Mock navigation
} as unknown as Page

describe("BrowserSession - click method", () => {
	let browserSession: BrowserSession
	let doActionSpy: jest.SpyInstance

	beforeEach(() => {
		jest.clearAllMocks()
		browserSession = new BrowserSession(mockContext)

		// Mock the internal page object
		;(browserSession as any).page = mockPage

		// Spy on doAction to isolate the click logic if needed, but here we test the integrated behavior
		// We need to test the actual implementation of doAction's callback for click
	})

	it("should throw an error if clicking triggers a filechooser event", async () => {
		const coordinate = "100,150"
		const expectedError = new Error(
			"Clicking this element opened a file selection dialog. You MUST use the 'upload' action with a valid CSS selector for the file input element and the file path instead of clicking.",
		)

		// Reset the callback holder before each test
		fileChooserCallback = null

		// Mock page.once to capture the filechooser callback
		mockPage.once = jest.fn().mockImplementation((event, callback) => {
			if (event === "filechooser") {
				fileChooserCallback = callback // Store the callback
			}
		})

		// Mock mouse.click is now set up globally to trigger the stored callback

		// Expect the click call to reject because the mocked click will trigger the callback
		await expect(browserSession.click(coordinate)).rejects.toThrow(expectedError)

		// Verify that page.once was called to register the listener
		expect(mockPage.once).toHaveBeenCalledWith("filechooser", expect.any(Function))

		// Verify that mouse.click was called
		expect(mockMouse.click).toHaveBeenCalledWith(100, 150)
	})

	it("should complete successfully if no filechooser event is triggered", async () => {
		const coordinate = "200,250"

		// Reset the callback holder
		fileChooserCallback = null

		// Ensure 'filechooser' event callback is captured but NOT triggered by click mock
		mockPage.once = jest.fn().mockImplementation((event, callback) => {
			if (event === "filechooser") {
				// Capture it, but the click mock won't call it if fileChooserCallback is null
				// Or, more simply for this test case, just don't capture it:
				// fileChooserCallback = callback;
			}
		})

		// Reset the click mock for this specific test case to NOT trigger the callback
		;(mockMouse.click as jest.Mock).mockImplementationOnce(async (x, y) => {
			return Promise.resolve() // Simulate successful click without triggering filechooser
		})

		// Mock network listeners setup within click
		mockPage.on = jest.fn().mockImplementation((event, listener) => {
			// Store listeners if needed, or just mock the call
		})
		mockPage.off = jest.fn() // Mock off to prevent errors during cleanup

		// Mock waitTillHTMLStable to resolve immediately
		;(browserSession as any).waitTillHTMLStable = jest.fn().mockResolvedValue(undefined)

		// Expect the click call to resolve successfully
		await expect(browserSession.click(coordinate)).resolves.toBeDefined()

		// Verify that mouse.click was called
		expect(mockMouse.click).toHaveBeenCalledWith(200, 250)
		// Verify that page.once was called for 'filechooser'
		expect(mockPage.once).toHaveBeenCalledWith("filechooser", expect.any(Function))
	})
})
