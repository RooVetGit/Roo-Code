export type InjectableConfigType =
	| string
	| {
			[key: string]:
				| undefined
				| null
				| boolean
				| number
				| InjectableConfigType
				| Array<undefined | null | boolean | number | InjectableConfigType>
	  }

/**
 * Normalizes a path to use forward slashes consistently
 * This ensures paths work correctly in JSON across all platforms
 */
function normalizePath(value: string): string {
	// Check if the value looks like a path (contains backslashes or forward slashes)
	if (value.includes("\\") || value.includes("/")) {
		// Convert to forward slashes for cross-platform compatibility
		return value.replace(/\\/g, "/")
	}
	return value
}

/**
 * Deeply injects environment variables into a configuration object/string/json
 *
 * Uses VSCode env:name pattern: https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 *
 * Does not mutate original object
 */
export async function injectEnv<C extends InjectableConfigType>(config: C, notFoundValue: any = "") {
	return injectVariables(config, { env: process.env }, notFoundValue)
}

/**
 * Deeply injects variables into a configuration object/string/json
 *
 * Uses VSCode's variables reference pattern: https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 *
 * Does not mutate original object
 *
 * There is a special handling for a nested (record-type) variables, where it is replaced by `propNotFoundValue` (if available) if the root key exists but the nested key does not.
 *
 * Matched keys that have `null` | `undefined` values are treated as not found.
 */
export async function injectVariables<C extends InjectableConfigType>(
	config: C,
	variables: Record<string, undefined | null | string | Record<string, undefined | null | string>>,
	propNotFoundValue?: any,
) {
	// Use simple regex replace for now, will see if object traversal and recursion is needed here (e.g: for non-serializable objects)
	const isObject = typeof config === "object"
	let _config: string = isObject ? JSON.stringify(config) : config

	// Intentionally using `== null` to match null | undefined
	for (const [key, value] of Object.entries(variables)) {
		if (value == null) continue

		if (typeof value === "string") {
			// Normalize paths to use forward slashes for cross-platform compatibility
			const normalizedValue = normalizePath(value)
			_config = _config.replace(new RegExp(`\\$\\{${key}\\}`, "g"), normalizedValue)
		} else {
			_config = _config.replace(new RegExp(`\\$\\{${key}:([\\w]+)\\}`, "g"), (match, name) => {
				if (value[name] == null)
					console.warn(`[injectVariables] variable "${name}" referenced but not found in "${key}"`)

				const replacementValue = value[name] ?? propNotFoundValue ?? match
				// Normalize paths if the replacement is a string
				return typeof replacementValue === "string" ? normalizePath(replacementValue) : replacementValue
			})
		}
	}

	return (isObject ? JSON.parse(_config) : _config) as C extends string ? string : C
}
