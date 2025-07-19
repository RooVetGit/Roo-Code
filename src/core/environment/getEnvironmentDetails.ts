import { XMLBuilder } from "fast-xml-parser"

import { Task } from "../task/Task"
import { getVscodeEditorContext } from "./context/vscode"
import { getTerminalContext } from "./context/terminal"
import { getFileContext } from "./context/file"
import { getMetadataContext } from "./context/metadata"
import { getWorkspaceContext } from "./context/workspace"
import { getTodoContext } from "./context/todo"

export async function getEnvironmentDetails(task: Task, includeFileDetails: boolean = false) {
	const [vscodeContext, terminalContext, fileContext, metadataContext, workspaceContext, todoContext] =
		await Promise.all([
			getVscodeEditorContext(task),
			getTerminalContext(task),
			getFileContext(task),
			getMetadataContext(task),
			getWorkspaceContext(task, includeFileDetails),
			getTodoContext(task),
		])

	const currentEnvDetails = {
		...vscodeContext,
		...terminalContext,
		...fileContext,
		...metadataContext,
		...workspaceContext,
		...todoContext,
	}

	const diffEnvDetails = _envDiff(currentEnvDetails, task.prevEnvDetails)

	task.prevEnvDetails = currentEnvDetails

	const builder = new XMLBuilder({
		format: true, // Enable pretty printing
		indentBy: "  ", // Use two spaces for indentation
		ignoreAttributes: false,
		attributeNamePrefix: "@",
		suppressEmptyNode: true, // Ensures tags with no children are excluded
		cdataPropName: "#cdata",
		textNodeName: "#text",
	})

	return builder.build({ environment_details: diffEnvDetails })
}

function _envDiff(current: any, previous: any): any {
	if (!previous) return current

	return Object.keys(current).reduce((acc, key) => {
		const currentValue = current[key]
		const previousValue = previous ? previous[key] : undefined

		if (_objIsEqual(currentValue, previousValue)) {
			return acc
		}

		// Check for nested objects (but not arrays)
		if (
			typeof currentValue === "object" &&
			currentValue !== null &&
			!Array.isArray(currentValue) &&
			typeof previousValue === "object" &&
			previousValue !== null &&
			!Array.isArray(previousValue)
		) {
			const nestedDiff = _envDiff(currentValue, previousValue)
			if (Object.keys(nestedDiff).length > 0) {
				acc[key] = nestedDiff
			}
		} else {
			// For primitives, arrays, or if previous was not an object
			acc[key] = currentValue
		}

		return acc
	}, {} as any)
}

function _objIsEqual(a: any, b: any): boolean {
	if (a === b) return true
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false

	const keysA = Object.keys(a)
	const keysB = Object.keys(b)

	if (keysA.length !== keysB.length) return false

	for (const key of keysA) {
		if (!keysB.includes(key) || !_objIsEqual(a[key], b[key])) return false
	}

	return true
}
