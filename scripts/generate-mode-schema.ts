import * as fs from "fs/promises"
import * as path from "path"
import { zodToJsonSchema } from "zod-to-json-schema"
import { modeConfigInputSchema } from "../src/modeSchemas"

/**
 * Generate a JSON schema from the Zod schema for mode configurations
 *
 * This script generates a JSON schema that supports both the original syntax (v1)
 * and the new object-based syntax (v2) for mode configuration.
 *
 * V1 syntax (tuple-based):
 * - Simple format: "read"
 * - With options: ["edit", { fileRegex: "\\.md$", description: "Markdown files" }]
 *
 * V2 syntax (object-based):
 * - Simple format: { group: "read" }
 * - With options: { group: "edit", options: { fileRegex: "\\.md$", description: "Markdown files" } }
 */
async function generateModeSchema() {
	// Convert the Zod schema to a JSON schema
	const jsonSchema = zodToJsonSchema(modeConfigInputSchema, {
		$refStrategy: "none",
		name: "ModeConfig",
	})

	// Add schema metadata
	const schemaWithMetadata = {
		$schema: "http://json-schema.org/draft-07/schema#",
		...jsonSchema,
		title: "Roo Code Mode Configuration",
		description: "Schema for Roo Code mode configuration YAML files",
		examples: [
			{
				name: "Example Mode",
				roleDefinition: "You are a specialized assistant focused on a specific task.",
				customInstructions: "Refer to project documentation when providing assistance.",
				groups: [
					{ group: "read" },
					{
						group: "edit",
						options: {
							fileRegex: "\\.(md|txt)$",
							description: "Markdown and text files",
						},
					},
					{ group: "command" },
				],
			},
		],
	}

	// Add additional documentation about the syntax options
	schemaWithMetadata.description =
		"Schema for Roo Code mode configuration YAML files. Supports object-based syntax for group entries."

	// Add documentation to the groups property in the schema
	// Cast to any to avoid TypeScript errors with the schema structure
	const schema = schemaWithMetadata as any
	if (schema.definitions?.ModeConfig?.properties?.groups) {
		schema.definitions.ModeConfig.properties.groups.description =
			'Tool groups that are allowed in this mode. Recommended syntax: { group: "read" } or ' +
			'{ group: "edit", options: { fileRegex: "\\\\.md$", description: "Markdown files" } }.'
	}

	// Write the schema to a file
	const schemaPath = path.join(__dirname, "..", "custom-mode-schema.json")
	await fs.writeFile(schemaPath, JSON.stringify(schemaWithMetadata, null, 2), "utf-8")

	console.log(`JSON schema generated at: ${schemaPath}`)
}

// Run the script
generateModeSchema().catch((error) => {
	console.error("Error generating schema:", error)
	process.exit(1)
})
