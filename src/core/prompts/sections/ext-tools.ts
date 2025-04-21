import { ExtensionToolManager } from "../../../services/extensions/ExtensionToolManager"

/**
 * Generates the section of the system prompt that describes available extension tools
 */
export async function getExtToolsSection(extensionToolManager?: ExtensionToolManager): Promise<string> {
	// If no manager is provided, get the singleton instance
	if (!extensionToolManager) {
		try {
			extensionToolManager = await ExtensionToolManager.getInstance()
		} catch (error) {
			console.error("Failed to get ExtensionToolManager:", error)
			return ""
		}
	}

	// Get all registered tools
	const allTools = extensionToolManager.getAllTools()

	if (allTools.length === 0) {
		return ""
	}

	// Group tools by extension
	const extensionTools: Record<string, string[]> = {}

	for (const { extensionId, tool } of allTools) {
		if (!extensionTools[extensionId]) {
			extensionTools[extensionId] = []
		}

		extensionTools[extensionId].push(`${tool.name}: ${tool.description}`)
	}

	let result = "# Available Extension Tools\n\n"

	for (const [extensionId, tools] of Object.entries(extensionTools)) {
		result += `## Extension: ${extensionId}\n\n`

		for (const toolDesc of tools) {
			result += `- ${toolDesc}\n`
		}

		result += "\n"
	}

	return result
}
