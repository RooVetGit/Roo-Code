// Constants for better maintainability
const ENUM_DISPLAY_THRESHOLD = 3

// JSON Schema type definitions
interface JsonSchemaProperty {
	type?: string
	format?: string
	enum?: string[]
	const?: any
	items?: JsonSchemaProperty | JsonSchemaProperty[]
	properties?: Record<string, JsonSchemaProperty>
	oneOf?: JsonSchemaProperty[]
	anyOf?: JsonSchemaProperty[]
	allOf?: JsonSchemaProperty[]
	description?: string
	default?: any
	// Numeric constraints
	minimum?: number
	maximum?: number
	multipleOf?: number
	// String constraints
	minLength?: number
	maxLength?: number
	pattern?: string
	// Array constraints
	minItems?: number
	maxItems?: number
}

interface JsonSchema {
	type?: string
	properties?: Record<string, JsonSchemaProperty>
	required?: string[]
	items?: JsonSchemaProperty | JsonSchemaProperty[]
	allOf?: JsonSchemaProperty[]
}

/**
 * Escapes special XML characters to prevent XSS vulnerabilities
 * @param text - The text to escape
 * @returns The escaped text safe for XML
 */
function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

/**
 * Merges properties from allOf schemas
 * @param allOf - Array of schema objects to merge
 * @returns Merged properties object
 */
function mergeAllOfProperties(allOf: JsonSchemaProperty[]): Record<string, JsonSchemaProperty> {
	const merged: Record<string, JsonSchemaProperty> = {}

	for (const schema of allOf) {
		if (schema.properties) {
			Object.assign(merged, schema.properties)
		}
	}

	return merged
}

/**
 * Converts a JSON Schema to a compact XML representation
 * @param schema - The JSON Schema to compress
 * @returns A compressed XML string representation of the schema
 */
export function jsonSchemaToXml(schema: JsonSchema | null | undefined): string {
	if (!schema || typeof schema !== "object") {
		return "<schema></schema>"
	}

	// Handle array schemas at root level
	if (schema.type === "array" && schema.items) {
		if (Array.isArray(schema.items)) {
			// Tuple array
			const itemTypes = schema.items.map((item) => getCompactType(item)).join(",")
			return `<schema>tuple[${itemTypes}]</schema>`
		} else {
			// Regular array
			const itemType = getCompactType(schema.items)
			return `<schema>array[${itemType}]</schema>`
		}
	}

	// Handle allOf at root level
	if (schema.allOf && Array.isArray(schema.allOf)) {
		const mergedProps = mergeAllOfProperties(schema.allOf)
		if (mergedProps && Object.keys(mergedProps).length > 0) {
			const required = schema.required || []
			const params = Object.entries(mergedProps).map(([key, prop]) => {
				const isRequired = required.includes(key) ? "*" : "?"
				const type = getCompactType(prop)
				const safeKey = escapeXml(key)
				return `${safeKey}${isRequired}:${type}`
			})
			return `<schema>merged{${params.join(", ")}}</schema>`
		}
	}

	if (!schema.properties || Object.keys(schema.properties).length === 0) {
		return "<schema></schema>"
	}

	const required = schema.required || []
	const params = Object.entries(schema.properties).map(([key, prop]) => {
		const isRequired = required.includes(key) ? "*" : "?"
		const type = getCompactType(prop)
		// Escape the key to prevent XSS
		const safeKey = escapeXml(key)
		return `${safeKey}${isRequired}:${type}`
	})

	return `<schema>${params.join(", ")}</schema>`
}

/**
 * Determines the compact type representation for a schema property
 * @param prop - The JSON Schema property
 * @returns A compact string representation of the type
 */
function getCompactType(prop: JsonSchemaProperty | null | undefined): string {
	if (!prop || typeof prop !== "object") {
		return "any"
	}

	// Handle array types with constraints
	if (prop.type === "array") {
		let arrayType = "array[any]"
		if (prop.items) {
			if (Array.isArray(prop.items)) {
				// Tuple array
				const itemTypes = prop.items.map((item) => getCompactType(item)).join(",")
				arrayType = `tuple[${itemTypes}]`
			} else {
				// Regular array
				const itemType = getCompactType(prop.items)
				arrayType = `array[${itemType}]`
			}
		}

		// Add array constraints
		if (prop.minItems !== undefined || prop.maxItems !== undefined) {
			const min = prop.minItems || 0
			const max = prop.maxItems || "∞"
			arrayType += `{${min}..${max}}`
		}

		return arrayType
	}

	// Handle const values (single constant)
	if (prop.const !== undefined) {
		const safeConstValue = escapeXml(prop.const.toString())
		return `const(${safeConstValue})`
	}

	// Handle enum types with more values displayed
	if (prop.enum && Array.isArray(prop.enum)) {
		if (prop.enum.length <= ENUM_DISPLAY_THRESHOLD) {
			// Escape enum values to prevent XSS
			const safeEnumValues = prop.enum.map((v) => escapeXml(v.toString())).join("|")
			return `enum(${safeEnumValues})`
		} else {
			// Just show "enum" for larger enums to keep it concise
			return "enum"
		}
	}

	// Handle allOf (intersection/merge)
	if (prop.allOf && Array.isArray(prop.allOf)) {
		const mergedProps = mergeAllOfProperties(prop.allOf)
		if (Object.keys(mergedProps).length > 0) {
			const nestedProps = Object.entries(mergedProps)
				.map(([k, v]) => `${escapeXml(k)}:${getCompactType(v)}`)
				.join(",")
			return `merged{${nestedProps}}`
		}
		return "merged"
	}

	// Handle object types
	if (prop.type === "object") {
		// Could potentially show nested structure for simple objects
		if (prop.properties && Object.keys(prop.properties).length <= 2) {
			const nestedProps = Object.entries(prop.properties)
				.map(([k, v]) => `${escapeXml(k)}:${getCompactType(v)}`)
				.join(",")
			return `object{${nestedProps}}`
		}
		return "object"
	}

	// Handle union types (oneOf/anyOf) - preserve constraints
	if (prop.oneOf || prop.anyOf) {
		const unionArray = prop.oneOf || prop.anyOf || []
		const parts = unionArray.map((p) => {
			// Handle enum within union
			if (p.enum) {
				if (p.enum.length <= 3) {
					const enumValues = p.enum.map((v) => escapeXml(v.toString())).join("|")
					return `enum(${enumValues})`
				}
				return `enum(${p.enum.length})`
			}

			// Handle number with constraints within union
			if (p.type === "number" || p.type === "integer") {
				const constraints = []
				if (p.minimum !== undefined) constraints.push(`≥${p.minimum}`)
				if (p.maximum !== undefined) constraints.push(`≤${p.maximum}`)
				return constraints.length > 0 ? `number(${constraints.join(",")})` : "number"
			}

			// Handle object with properties count within union
			if (p.type === "object" && p.properties) {
				const propCount = Object.keys(p.properties).length
				return propCount <= 2 ? `object(${propCount})` : "object"
			}

			// Recursively handle other types
			return getCompactType(p)
		})

		return parts.join("|")
	}

	// Handle basic types with constraints
	switch (prop.type) {
		case "string": {
			let stringType = "string"

			// Format handling
			if (prop.format === "date") stringType = "date"
			else if (prop.format === "date-time") stringType = "datetime"
			else if (prop.format === "email") stringType = "email"
			else if (prop.format === "uri" || prop.format === "url") stringType = "url"
			else if (prop.format === "uuid") stringType = "uuid"
			else if (prop.format === "ipv4") stringType = "ipv4"
			else if (prop.format === "ipv6") stringType = "ipv6"

			// Length constraints
			const constraints = []
			if (prop.minLength !== undefined) constraints.push(`≥${prop.minLength}`)
			if (prop.maxLength !== undefined) constraints.push(`≤${prop.maxLength}`)
			if (prop.pattern) {
				const shortPattern = prop.pattern.length > 10 ? prop.pattern.slice(0, 10) : prop.pattern
				constraints.push(`/${shortPattern}/`)
			}

			// Add default value if present
			let finalType = constraints.length > 0 ? `${stringType}(${constraints.join(",")})` : stringType
			if (prop.default !== undefined) {
				const defaultValue = escapeXml(prop.default.toString())
				finalType += `="${defaultValue}"`
			}
			return finalType
		}

		case "number":
		case "integer": {
			const numConstraints = []
			if (prop.minimum !== undefined) numConstraints.push(`≥${prop.minimum}`)
			if (prop.maximum !== undefined) numConstraints.push(`≤${prop.maximum}`)
			if (prop.multipleOf !== undefined) numConstraints.push(`×${prop.multipleOf}`)

			let finalType = numConstraints.length > 0 ? `number(${numConstraints.join(",")})` : "number"
			if (prop.default !== undefined) {
				finalType += `=${prop.default}`
			}
			return finalType
		}

		case "boolean": {
			let boolType = "boolean"
			if (prop.default !== undefined) {
				boolType += `=${prop.default}`
			}
			return boolType
		}
		case "null":
			return "null"
		default:
			return prop.type || "any"
	}
}
