/**
 * Interface for the ClineMessage structure based on roo-code.d.ts
 */
export interface ClineMessage {
	ts: number
	type: "ask" | "say"
	ask?:
		| "followup"
		| "command"
		| "command_output"
		| "completion_result"
		| "tool"
		| "api_req_failed"
		| "resume_task"
		| "resume_completed_task"
		| "mistake_limit_reached"
		| "browser_action_launch"
		| "use_mcp_server"
		| "finishTask"
	say?:
		| "task"
		| "error"
		| "api_req_started"
		| "api_req_finished"
		| "api_req_retried"
		| "api_req_retry_delayed"
		| "api_req_deleted"
		| "text"
		| "reasoning"
		| "completion_result"
		| "user_feedback"
		| "user_feedback_diff"
		| "command_output"
		| "tool"
		| "shell_integration_warning"
		| "browser_action"
		| "browser_action_result"
		| "command"
		| "mcp_server_request_started"
		| "mcp_server_response"
		| "new_task_started"
		| "new_task"
		| "subtask_result"
		| "checkpoint_saved"
		| "rooignore_error"
		| "diff_error"
	text?: string
	images?: string[]
	partial?: boolean
	reasoning?: string
	conversationHistoryIndex?: number
}

/**
 * Interface for the followup question structure
 */
export interface FollowupQuestion {
	question: string
	suggest: string[]
}

/**
 * Check if a message is an "ask" type message with "followup" ask type
 * @param message The message to check
 * @returns True if the message is an "ask" type message with "followup" ask type
 */
export function isFollowupMessage(message: ClineMessage): boolean {
	return message.type === "ask" && message.ask === "followup" && !!message.text
}

/**
 * Parse a followup question from a message text
 * @param messageText The message text to parse
 * @returns The parsed followup question or null if not valid
 */
export function parseFollowupQuestion(messageText: string): FollowupQuestion | null {
	try {
		const data = JSON.parse(messageText)
		if (
			data &&
			typeof data === "object" &&
			typeof data.question === "string" &&
			Array.isArray(data.suggest) &&
			data.suggest.every((item: any) => typeof item === "string")
		) {
			return {
				question: data.question,
				suggest: data.suggest,
			}
		}
	} catch (error) {
		// Not a valid JSON or not a followup question
	}
	return null
}
