/**
 * Represents a message directive from the assistant to the system.
 * This directive instructs the system to output text.
 */
export interface TextDirective {
	type: "text"
	content: string
	partial: boolean
}
