export interface NotificationTrigger {
	type: "approval_request" | "error" | "completion" | "input_required" | "timeout_warning"
	priority: "critical" | "high" | "medium" | "low"
	title: string
	message: string
	context?: {
		toolName?: string
		action?: string
		errorType?: string
		sessionId: string
	}
	actions?: NotificationAction[]
}

export interface NotificationAction {
	id: string
	label: string
	action: "approve" | "deny" | "view" | "dismiss" | "custom"
}

export interface NotificationPreferences {
	enabled: boolean
	showApprovalRequests: boolean
	showErrors: boolean
	showTaskCompletion: boolean
	showUserInputRequired: boolean
	showSessionTimeouts: boolean
	timeout: number
	sound: boolean
}

export interface NotificationService {
	initialize(): Promise<void>
	sendNotification(notification: NotificationTrigger): Promise<boolean>
	updateNotification(id: string, updates: Partial<NotificationTrigger>): Promise<boolean>
	dismissNotification(id: string): Promise<boolean>
	setUserPreferences(preferences: NotificationPreferences): Promise<void>
	isSupported(): boolean
}
