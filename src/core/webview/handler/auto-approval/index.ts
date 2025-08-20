import { IWebviewMessageHandlerRegistry } from "../types"
import { AlwaysAllowReadOnlyHandler } from "./alwaysAllowReadOnlyHandler"
import { AlwaysAllowReadOnlyOutsideWorkspaceHandler } from "./alwaysAllowReadOnlyOutsideWorkspaceHandler"
import { AlwaysAllowWriteHandler } from "./alwaysAllowWriteHandler"
import { AlwaysAllowWriteOutsideWorkspaceHandler } from "./alwaysAllowWriteOutsideWorkspaceHandler"
import { AlwaysAllowWriteProtectedHandler } from "./alwaysAllowWriteProtectedHandler"
import { AlwaysAllowExecuteHandler } from "./alwaysAllowExecuteHandler"
import { AlwaysAllowBrowserHandler } from "./alwaysAllowBrowserHandler"
import { AlwaysAllowMcpHandler } from "./alwaysAllowMcpHandler"
import { AlwaysAllowModeSwitchHandler } from "./alwaysAllowModeSwitchHandler"
import { AllowedMaxRequestsHandler } from "./allowedMaxRequestsHandler"
import { AllowedMaxCostHandler } from "./allowedMaxCostHandler"
import { AlwaysAllowSubtasksHandler } from "./alwaysAllowSubtasksHandler"
import { AlwaysAllowUpdateTodoListHandler } from "./alwaysAllowUpdateTodoListHandler"
import { AlwaysApproveResubmitHandler } from "./alwaysApproveResubmitHandler"
import { AlwaysAllowFollowupQuestionsHandler } from "./alwaysAllowFollowupQuestionsHandler"

export function registerAutoApprovalHandler(register: IWebviewMessageHandlerRegistry) {
	register.registerHandler("alwaysAllowReadOnly", new AlwaysAllowReadOnlyHandler())
	register.registerHandler("alwaysAllowReadOnlyOutsideWorkspace", new AlwaysAllowReadOnlyOutsideWorkspaceHandler())
	register.registerHandler("alwaysAllowWrite", new AlwaysAllowWriteHandler())
	register.registerHandler("alwaysAllowWriteOutsideWorkspace", new AlwaysAllowWriteOutsideWorkspaceHandler())
	register.registerHandler("alwaysAllowWriteProtected", new AlwaysAllowWriteProtectedHandler())
	register.registerHandler("alwaysAllowBrowser", new AlwaysAllowBrowserHandler())
	register.registerHandler("alwaysAllowExecute", new AlwaysAllowExecuteHandler())
	register.registerHandler("alwaysAllowMcp", new AlwaysAllowMcpHandler())
	register.registerHandler("alwaysAllowModeSwitch", new AlwaysAllowModeSwitchHandler())
	register.registerHandler("allowedMaxRequests", new AllowedMaxRequestsHandler())
	register.registerHandler("allowedMaxCost", new AllowedMaxCostHandler())
	register.registerHandler("alwaysAllowSubtasks", new AlwaysAllowSubtasksHandler())
	register.registerHandler("alwaysAllowUpdateTodoList", new AlwaysAllowUpdateTodoListHandler())
	register.registerHandler("alwaysApproveResubmit", new AlwaysApproveResubmitHandler())
	register.registerHandler("alwaysAllowFollowupQuestions", new AlwaysAllowFollowupQuestionsHandler())
}
