import { ParserOptions } from "./types"

export function addValueToObject(obj: any, key: string, value: any, customOptions: Required<ParserOptions>): void {
	const effectiveTextNodeName = customOptions.textNodeName
	const alwaysCreate = customOptions.alwaysCreateTextNode

	// Early return if key doesn't exist
	if (!Object.prototype.hasOwnProperty.call(obj, key)) {
		obj[key] = value
		return
	}

	// Handle string concatenation case
	const isTextNode = key === effectiveTextNodeName
	const areStrings = typeof obj[key] === "string" && typeof value === "string"
	if (isTextNode && areStrings && (!alwaysCreate || (alwaysCreate && isTextNode))) {
		obj[key] += value
		return
	}

	// Convert to array if needed and push new value
	if (!Array.isArray(obj[key])) {
		obj[key] = [obj[key]]
	}
	obj[key][obj[key].length] = value
}
