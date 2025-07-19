// Constants for better maintainability
const ENUM_DISPLAY_THRESHOLD = 3

// JSON Schema type definitions
interface JsonSchemaProperty {
	type?: string
	format?: string
	enum?: string[]
	items?: JsonSchemaProperty
	properties?: Record<string, JsonSchemaProperty>
	oneOf?: JsonSchemaProperty[]
	anyOf?: JsonSchemaProperty[]
	description?: string
}

interface JsonSchema {
	type?: string
	properties?: Record<string, JsonSchemaProperty>
	required?: string[]
	items?: JsonSchemaProperty
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
		const itemType = getCompactType(schema.items)
		return `<schema>array[${itemType}]</schema>`
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

	// Handle array types
	if (prop.type === "array") {
		if (prop.items) {
			const itemType = getCompactType(prop.items)
			return `array[${itemType}]`
		}
		return "array[any]"
	}

	// Handle enum types
	if (prop.enum && Array.isArray(prop.enum)) {
		if (prop.enum.length <= ENUM_DISPLAY_THRESHOLD) {
			// Escape enum values to prevent XSS
			const safeEnumValues = prop.enum.map(escapeXml).join("|")
			return `enum(${safeEnumValues})`
		}
		return "enum"
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

	// Handle union types (oneOf/anyOf)
	if (prop.oneOf || prop.anyOf) {
		const unionArray = prop.oneOf || prop.anyOf || []
		const types = unionArray.map((p) => p.type).filter((t): t is string => Boolean(t))

		if (types.length > 0) {
			return types.join("|")
		}
		return "union"
	}

	// Handle string types with formats
	switch (prop.type) {
		case "string":
			if (prop.format === "date") return "date"
			if (prop.format === "date-time") return "datetime"
			if (prop.format === "email") return "email"
			if (prop.format === "uri" || prop.format === "url") return "url"
			if (prop.format === "uuid") return "uuid"
			if (prop.format === "ipv4") return "ipv4"
			if (prop.format === "ipv6") return "ipv6"
			return "string"
		case "number":
		case "integer":
			return "number"
		case "boolean":
			return "boolean"
		case "null":
			return "null"
		default:
			return prop.type || "any"
	}
}
