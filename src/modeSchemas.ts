import { z } from "zod"

// Tool Groups
export const toolGroups = ["read", "edit", "browser", "command", "mcp", "modes"] as const
export const toolGroupsSchema = z.enum(toolGroups)
export type ToolGroup = z.infer<typeof toolGroupsSchema>

// Group Options
export const groupOptionsSchema = z.object({
	fileRegex: z
		.string()
		.optional()
		.refine(
			(pattern) => {
				if (!pattern) {
					return true // Optional, so empty is valid.
				}

				try {
					new RegExp(pattern)
					return true
				} catch {
					return false
				}
			},
			{ message: "Invalid regular expression pattern" },
		),
	description: z.string().optional(),
})

export type GroupOptions = z.infer<typeof groupOptionsSchema>

// Group Entry V2 (Object-based syntax)
export const groupEntryV2Schema = z.object({
	group: toolGroupsSchema,
	options: groupOptionsSchema.optional(),
})
export type GroupEntryV2 = z.infer<typeof groupEntryV2Schema>

// Group Entry (supports both v1 tuple-based and v2 object-based syntax)
export const groupEntrySchema = z.union([
	toolGroupsSchema, // Simple string format: "read"
	z.tuple([toolGroupsSchema, groupOptionsSchema]), // V1 tuple format: ["edit", { fileRegex: "\\.md$" }]
	groupEntryV2Schema, // V2 object format: { group: "edit", options: { fileRegex: "\\.md$" } }
])
export type GroupEntry = z.infer<typeof groupEntrySchema>

// Group Entry Array with validation to prevent duplicates
export const groupEntryArraySchema = z.array(groupEntrySchema).refine(
	(groups) => {
		const seen = new Set()

		return groups.every((group) => {
			// Extract the group name based on the entry format
			let groupName: string

			if (typeof group === "string") {
				// Simple string format: "read"
				groupName = group
			} else if (Array.isArray(group)) {
				// V1 tuple format: ["edit", { fileRegex: "\\.md$" }]
				groupName = group[0]
			} else {
				// V2 object format: { group: "edit", options: { fileRegex: "\\.md$" } }
				groupName = group.group
			}

			if (seen.has(groupName)) {
				return false
			}

			seen.add(groupName)
			return true
		})
	},
	{ message: "Duplicate groups are not allowed" },
)

// Mode Config Input Schema (Corresponds to YAML file content - slug & source removed)
export const modeConfigInputSchema = z.object({
	name: z.string().min(1, "Name is required"),
	roleDefinition: z.string().min(1, "Role definition is required"),
	customInstructions: z.string().optional(),
	groups: groupEntryArraySchema,
})

export type ModeConfigInput = z.infer<typeof modeConfigInputSchema>

// Actual ModeConfig type used internally (includes slug and source)
export type ModeConfig = ModeConfigInput & {
	slug: string
	source: "global" | "project" // Indicates where the mode was loaded from
}

// Full Mode Config Schema (for validation when loading from files)
export const modeConfigSchema = modeConfigInputSchema.extend({
	slug: z.string().regex(/^[a-zA-Z0-9-]+$/, "Slug must contain only letters numbers and dashes"),
	source: z.enum(["global", "project"]),
})
