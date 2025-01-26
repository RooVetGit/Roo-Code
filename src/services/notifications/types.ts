import { ClineAsk } from "../../shared/ExtensionMessage"

export type NotificationType = 'approval' | 'question' | 'completion'

export interface NotificationRequest {
    type: NotificationType
    message: string
    requestId: string
    metadata?: {
        toolName?: string
        path?: string
        command?: string
    }
}

export interface NotificationResponse {
    requestId: string
    type: 'approve' | 'deny' | 'text'
    text?: string
}

export interface NotificationProvider {
    /**
     * Initialize the notification provider with any necessary setup
     */
    initialize(): Promise<void>

    /**
     * Send a notification through this provider
     */
    sendNotification(request: NotificationRequest): Promise<void>

    /**
     * Register a callback to handle responses from this provider
     */
    onResponse(callback: (response: NotificationResponse) => void): void

    /**
     * Clean up any resources used by this provider
     */
    dispose(): Promise<void>
}

export interface NotificationSettings {
    enabled: boolean
    [key: string]: any
}

export function mapClineAskToNotificationType(askType: ClineAsk): NotificationType {
    switch (askType) {
        case 'tool':
        case 'command':
        case 'browser_action_launch':
        case 'use_mcp_server':
            return 'approval'
        case 'followup':
            return 'question'
        default:
            return 'approval'
    }
}