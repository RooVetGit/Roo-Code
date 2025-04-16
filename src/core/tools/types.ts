import { ClineAsk, ToolProgressStatus } from "../../schemas"
import { ToolParamName } from "../assistant-message"
import { ToolResponse } from "../Cline"

export type AskApproval = (
	type: ClineAsk,
	partialMessage?: string,
	progressStatus?: ToolProgressStatus,

	// metadata is used to pass additional arbitrary user data to the webview as necessary
	metadata?: Record<string, unknown>,
) => Promise<boolean>

export type HandleError = (action: string, error: Error) => Promise<void>

export type PushToolResult = (content: ToolResponse) => void

export type RemoveClosingTag = (tag: ToolParamName, content?: string) => string

export type AskFinishSubTaskApproval = () => Promise<boolean>

export type ToolDescription = () => string
