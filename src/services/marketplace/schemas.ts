import { z } from "zod"

/**
 * Base metadata schema with common fields
 */
export const baseMetadataSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	version: z
		.string()
		.refine((v) => /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(v), "Version must be in semver format"),
	binaryUrl: z.string().url("Binary URL must be a valid URL").optional(),
	binaryHash: z.string().optional(),
	tags: z.array(z.string()).optional(),
	author: z.string().optional(),
	authorUrl: z.string().url("Author URL must be a valid URL").optional(),
	sourceUrl: z.string().url("Source URL must be a valid URL").optional(),
})

/**
 * Component type validation
 */
export const marketplaceItemTypeSchema = z.enum(["mode", "prompt", "package", "mcp"] as const)

/**
 * Repository metadata schema
 */
export const repositoryMetadataSchema = baseMetadataSchema

/**
 * Component metadata schema
 */
export const componentMetadataSchema = baseMetadataSchema.extend({
	type: marketplaceItemTypeSchema,
})

/**
 * External item reference schema
 */
export const externalItemSchema = z.object({
	type: marketplaceItemTypeSchema,
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
				case "mcp":
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

/**
 * Schema for a single marketplace item parameter
 */
export const parameterSchema = z.record(z.string(), z.any())

/**
 * Schema for a marketplace item
 */
export const marketplaceItemSchema = baseMetadataSchema.extend({
	id: z.string(),
	type: marketplaceItemTypeSchema,
	url: z.string(),
	repoUrl: z.string(),
	sourceName: z.string().optional(),
	lastUpdated: z.string().optional(),
	defaultBranch: z.string().optional(),
	path: z.string().optional(),
	items: z
		.array(
			z.object({
				type: marketplaceItemTypeSchema,
				path: z.string(),
				metadata: componentMetadataSchema.optional(),
				lastUpdated: z.string().optional(),
				matchInfo: z
					.object({
						// Assuming MatchInfo is an object, adjust if needed
						matched: z.boolean(),
						matchReason: z
							.object({
								nameMatch: z.boolean().optional(),
								descriptionMatch: z.boolean().optional(),
								tagMatch: z.boolean().optional(),
								typeMatch: z.boolean().optional(),
								hasMatchingSubcomponents: z.boolean().optional(),
							})
							.optional(),
					})
					.optional(),
			}),
		)
		.optional(),
	matchInfo: z
		.object({
			// Assuming MatchInfo is an object, adjust if needed
			matched: z.boolean(),
			matchReason: z
				.object({
					nameMatch: z.boolean().optional(),
					descriptionMatch: z.boolean().optional(),
					tagMatch: z.boolean().optional(),
					typeMatch: z.boolean().optional(),
					hasMatchingSubcomponents: z.boolean().optional(),
				})
				.optional(),
		})
		.optional(),
	parameters: z.record(z.string(), z.any()).optional(),
})
