import { getBrowserActionDescription } from "../browser-action"
import { ToolArgs } from "../types"

describe("getBrowserActionDescription", () => {
	let defaultArgs: ToolArgs

	beforeEach(() => {
		defaultArgs = {
			cwd: "/test/path",
			supportsComputerUse: true,
			browserViewportSize: "1280x800",
			diffStrategy: undefined,
			mcpHub: undefined,
			toolOptions: {},
		}
	})

	it("should return undefined when computer use is not supported", () => {
		const args: ToolArgs = {
			...defaultArgs,
			supportsComputerUse: false,
		}

		const result = getBrowserActionDescription(args)
		expect(result).toBeUndefined()
	})

	it("should return browser action description when computer use is supported", () => {
		const result = getBrowserActionDescription(defaultArgs)

		// Check for main sections
		expect(result).toContain("## browser_action")
		expect(result).toContain("Description:")
		expect(result).toContain("Parameters:")
		expect(result).toContain("Usage:")
		expect(result).toContain("Example:")

		// Check for all action types
		expect(result).toContain("* launch:")
		expect(result).toContain("* click:")
		expect(result).toContain("* type:")
		expect(result).toContain("* scroll_down:")
		expect(result).toContain("* scroll_up:")
		expect(result).toContain("* set_viewport:")
		expect(result).toContain("* close:")

		// Check for parameter descriptions
		expect(result).toContain("- action: (required)")
		expect(result).toContain("- url: (optional)")
		expect(result).toContain("- coordinate: (optional)")
		expect(result).toContain("- text: (optional)")
		expect(result).toContain("- viewport: (optional)")
	})

	it("should include viewport size in description", () => {
		const args: ToolArgs = {
			...defaultArgs,
			browserViewportSize: "1024x768",
		}

		const result = getBrowserActionDescription(args)
		expect(result).toContain("1024x768")
	})

	it("should include important usage guidelines", () => {
		const result = getBrowserActionDescription(defaultArgs)

		// Check for key usage guidelines
		expect(result).toContain("must always start with** launching the browser")
		expect(result).toContain("must always end with** closing the browser")
		expect(result).toContain("only the `browser_action` tool can be used")
		expect(result).toContain("click should be targeted at the **center of the element**")
	})

	it("should include viewport size in coordinate parameter description", () => {
		const args: ToolArgs = {
			...defaultArgs,
			browserViewportSize: "1024x768",
		}

		const result = getBrowserActionDescription(args)
		expect(result).toContain("Coordinates should be within the **1024x768** resolution")
	})

	it("should include examples for each action type", () => {
		const result = getBrowserActionDescription(defaultArgs)

		// Check for examples
		expect(result).toContain("<action>launch</action>")
		expect(result).toContain("<action>click</action>")
		expect(result).toContain("<action>set_viewport</action>")
		expect(result).toContain("<url>https://example.com</url>")
		expect(result).toContain("<coordinate>450,300</coordinate>")
		expect(result).toContain("<viewport>375x667</viewport>")
	})

	it("should include common viewport sizes in set_viewport description", () => {
		const result = getBrowserActionDescription(defaultArgs)

		expect(result).toContain("Desktop (900x600)")
		expect(result).toContain("iPhone SE (375x667)")
		expect(result).toContain("iPad (768x1024)")
		expect(result).toContain("iPhone 12 Pro (390x844)")
	})
})
