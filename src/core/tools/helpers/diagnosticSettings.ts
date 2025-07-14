import { Task } from "../../task/Task"
import {
	DEFAULT_INCLUDE_DIAGNOSTIC_MESSAGES,
	DEFAULT_MAX_DIAGNOSTIC_MESSAGES,
} from "../../constants/diagnosticSettings"

/**
 * Retrieves diagnostic settings from the provider state
 * @param cline - The Task instance
 * @returns Object containing diagnostic settings with defaults
 */
export async function getDiagnosticSettings(cline: Task): Promise<{
	includeDiagnosticMessages: boolean
	maxDiagnosticMessages: number
}> {
	const state = await cline.providerRef?.deref()?.getState()

	return {
		includeDiagnosticMessages: state?.includeDiagnosticMessages ?? DEFAULT_INCLUDE_DIAGNOSTIC_MESSAGES,
		maxDiagnosticMessages: state?.maxDiagnosticMessages ?? DEFAULT_MAX_DIAGNOSTIC_MESSAGES,
	}
}
