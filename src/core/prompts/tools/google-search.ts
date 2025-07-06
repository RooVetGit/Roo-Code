import { ToolArgs } from "./types"

export function getGoogleSearchDescription(args: ToolArgs): string {
	return `
# google_search
Description: When you need to answer questions about current events or things that have happened since your knowledge cutoff, you can use this tool to get information from the web.
`
}
