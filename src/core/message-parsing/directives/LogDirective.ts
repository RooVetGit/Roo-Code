export const logLevels = ["debug", "info", "warn", "error"] as const

/**
 * Represents a log message directive from the assistant to the system.
 * This directive instructs the system to record a message to its internal logs.
 */
export interface LogDirective {
	type: "log_message"
	message: string
	level: (typeof logLevels)[number]
	partial: boolean
}
