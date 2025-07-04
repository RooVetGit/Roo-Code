export async function createMermaidFixInstructions(error: string, code: string): Promise<string> {
	return [
		"Please fix the following Mermaid diagram.",
		error ? `Error: ${error}` : "",
		"Diagram code:",
		"```mermaid",
		code,
		"```",
	]
		.filter(Boolean)
		.join("\n\n")
}
