import { z } from "zod"
import { ComponentType } from "./types"

/**
 * Base metadata schema with common fields
 */
export const baseMetadataSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g., 1.0.0)"),
	tags: z.array(z.string()).optional(),
})

/**
 * Component type validation
 */
export const componentTypeSchema = z.enum(["mode", "prompt", "package", "mcp server"] as const)

/**
 * Repository metadata schema
 */
export const repositoryMetadataSchema = baseMetadataSchema

/**
 * Component metadata schema
 */
export const componentMetadataSchema = baseMetadataSchema.extend({
	type: componentTypeSchema,
})

/**
 * External item reference schema
 */
export const externalItemSchema = z.object({
	type: componentTypeSchema,
	path: z.string().min(1, "Path is required"),
})

/**
 * Package metadata schema
 */
export const packageMetadataSchema = componentMetadataSchema.extend({
	type: z.literal("package"),
	items: z.array(externalItemSchema).optional(),
})

/**
 * Validate parsed YAML against a schema
 * @param data Data to validate
 * @param schema Schema to validate against
 * @returns Validated data
 * @throws Error if validation fails
 */
export function validateMetadata<T>(data: unknown, schema: z.ZodType<T>): T {
	try {
		return schema.parse(data)
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues
				.map((issue) => {
					const path = issue.path.join(".")
					// Format error messages to match expected format
					if (issue.message === "Required") {
						if (path === "name") {
							return "name: Name is required"
						}
						return path ? `${path}: ${path.split(".").pop()} is required` : "Required field missing"
					}
					if (issue.code === "invalid_enum_value") {
						return path ? `${path}: Invalid value "${issue.received}"` : `Invalid value "${issue.received}"`
					}
					return path ? `${path}: ${issue.message}` : issue.message
				})
				.join("\n")
			throw new Error(issues)
		}
		throw error
	}
}

/**
 * Determine metadata type and validate
 * @param data Data to validate
 * @returns Validated metadata
 * @throws Error if validation fails
 */
export function validateAnyMetadata(data: unknown) {
	// Try to determine the type of metadata
	if (typeof data === "object" && data !== null) {
		const obj = data as Record<string, unknown>

		if ("type" in obj) {
			const type = obj.type
			switch (type) {
				case "package":
					return validateMetadata(data, packageMetadataSchema)
				case "mode":
				case "mcp server":
				case "prompt":
				case "role":
				case "storage":
					return validateMetadata(data, componentMetadataSchema)
				default:
					throw new Error(`Unknown component type: ${String(type)}`)
			}
		} else {
			// No type field, assume repository metadata
			return validateMetadata(data, repositoryMetadataSchema)
		}
	}

	throw new Error("Invalid metadata: must be an object")
}
