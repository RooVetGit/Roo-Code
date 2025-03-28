import { ToolArgs } from "./types"

export function getBrowserActionDescription(args: ToolArgs): string | undefined {
	if (!args.supportsComputerUse) {
		return undefined
	}
	return `## browser_action
Description: Request to interact with a Puppeteer-controlled browser. Every action, except \`close\`, will be responded to with a screenshot of the browser's current state, along with any new console logs. You may only perform one browser action per message, and wait for the user's response including a screenshot and logs to determine the next action.
- The sequence of actions **must always start with** launching the browser at a URL, and **must always end with** closing the browser. If you need to visit a new URL that is not possible to navigate to from the current webpage, you must first close the browser, then launch again at the new URL.
- While the browser is active, only the \`browser_action\` tool can be used. No other tools should be called during this time. You may proceed to use other tools only after closing the browser. For example if you run into an error and need to fix a file, you must close the browser, then use other tools to make the necessary changes, then re-launch the browser to verify the result.
- **IMPORTANT: NEVER click on buttons that would open a system file dialog.** Instead, use the \`upload\` action directly with the file input element's selector and the desired file path.
- The browser window has a resolution of **${args.browserViewportSize}** pixels. When performing any click actions, ensure the coordinates are within this resolution range.
- Before clicking on any elements such as icons, links, or buttons, you must consult the provided screenshot of the page to determine the coordinates of the element. The click should be targeted at the **center of the element**, not on its edges.
Parameters:
- action: (required) The action to perform. The available actions are:
    * launch: Launch a new Puppeteer-controlled browser instance at the specified URL. This **must always be the first action**.
        - Use with the \`url\` parameter to provide the URL.
        - Ensure the URL is valid and includes the appropriate protocol (e.g. http://localhost:3000/page, file:///path/to/file.html, etc.)
    * click: Click at a specific x,y coordinate.
        - Use with the \`coordinate\` parameter to specify the location.
        - Always click in the center of an element (icon, button, link, etc.) based on coordinates derived from a screenshot.
        - **DO NOT click on buttons labeled "Upload", "Choose File", "Browse", or similar that would open system file dialogs.** Use the \`upload\` action instead.
    * type: Type a string of text on the keyboard. You might use this after clicking on a text field to input text.
        - Use with the \`text\` parameter to provide the string to type.
    * scroll_down: Scroll down the page by one page height.
    * scroll_up: Scroll up the page by one page height.
    * upload: **UPLOAD FILES DIRECTLY WITH THIS ACTION - DO NOT CLICK ON UPLOAD BUTTONS.** This action uploads a file to a file input element on the page by directly setting its value, bypassing any system file dialogs.
        - Use with the \`selector\` parameter to specify the CSS selector for the file input element (typically \`input[type="file"]\`).
        - Use with the \`filepath\` parameter to specify the path to the file to upload.
        - **IMPORTANT:** Always use this action instead of clicking on buttons that would open system file dialogs.
    * close: Close the Puppeteer-controlled browser instance. This **must always be the final browser action**.
        - Example: \`<action>close</action>\`
- url: (optional) Use this for providing the URL for the \`launch\` action.
    * Example: <url>https://example.com</url>
- coordinate: (optional) The X and Y coordinates for the \`click\` action. Coordinates should be within the **${args.browserViewportSize}** resolution.
    * Example: <coordinate>450,300</coordinate>
- text: (optional) Use this for providing the text for the \`type\` action.
    * Example: <text>Hello, world!</text>
- selector: (optional) The CSS selector for the file input element for the \`upload\` action.
    * Example: <selector>input[type="file"]</selector>
- filepath: (optional) The **absolute** path to the file to upload for the \`upload\` action.
    * Example: <filepath>/Users/username/path/to/file.jpg</filepath>
Usage:
<browser_action>
<action>Action to perform (e.g., launch, click, type, scroll_down, scroll_up, upload, close)</action>
<url>URL to launch the browser at (optional)</url>
<coordinate>x,y coordinates (optional)</coordinate>
<text>Text to type (optional)</text>
<selector>CSS selector for file input (optional)</selector>
<filepath>Path to file to upload (optional)</filepath>
</browser_action>

Example: Requesting to launch a browser at https://example.com
<browser_action>
<action>launch</action>
<url>https://example.com</url>
</browser_action>

Example: Requesting to click on the element at coordinates 450,300
<browser_action>
<action>click</action>
<coordinate>450,300</coordinate>
</browser_action>

Example: Requesting to upload a file to a file input element
<browser_action>
<action>upload</action>
<selector>input[type="file"]</selector>
<filepath>/path/to/file.jpg</filepath>
</browser_action>`
}
