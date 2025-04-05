import { ToolArgs } from "./types"

export function getBrowserActionDescription(args: ToolArgs): string | undefined {
	if (!args.supportsComputerUse) {
		return undefined
	}
	return `## browser_action
Interact with Puppeteer-controlled browser. Each action returns a screenshot and logs.

Rules:
- Sequence must start with launch and end with close
- Only use browser_action while browser is open
- Viewport size: ${args.browserViewportSize}px
- Click center of elements based on screenshot coordinates
Parameters:
- action: Required action type:
  * launch: Start browser at URL (first action)
  * click: Click at x,y coordinates
  * type: Input text
  * scroll_down/scroll_up: Page navigation
  * close: End session (last action)
- url: For launch (e.g. <url>https://example.com</url>)
- coordinate: For click (e.g. <coordinate>450,300</coordinate>)
- text: For type (e.g. <text>Hello</text>)
Usage:
<browser_action>
<action>action_type</action>
<url>launch_url</url>  <!-- optional -->
<coordinate>x,y</coordinate>  <!-- optional -->
<text>input_text</text>  <!-- optional -->
</browser_action>

Examples:
<browser_action>
<action>launch</action>
<url>https://example.com</url>
</browser_action>

<browser_action>
<action>click</action>
<coordinate>450,300</coordinate>
</browser_action>`
}
