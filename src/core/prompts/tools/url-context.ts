import { ToolArgs } from "./types"

export function getUrlContextDescription(args: ToolArgs): string {
	return `
# url_context
Description: When you need to retrieve content from a URL to inform your response, you can use this tool.
`
}
