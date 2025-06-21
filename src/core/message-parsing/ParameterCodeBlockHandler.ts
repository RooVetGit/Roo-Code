import { DirectiveHandler } from "./DirectiveHandler"

/**
 * Interface for directive handlers that support parameter code block detection.
 * Extends the base DirectiveHandler to include methods and properties specific to
 * tool directive handling.
 */
export interface ParameterCodeBlockHandler extends DirectiveHandler {
	isInsideParameterCodeBlock(): boolean
	currentContext: "param" | "none"
	currentParamName?: string
}
