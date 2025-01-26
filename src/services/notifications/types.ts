import { ClineAsk } from '../../shared/ExtensionMessage';

export type NotificationType = 'approval' | 'question';

export interface NotificationRequest {
    type: NotificationType;
    message: string;
    requestId: string;
    metadata?: {
        toolName?: string;
        path?: string;
        command?: string;
    };
}

export interface NotificationResponse {
    requestId: string;
    type: 'approve' | 'deny' | 'text';
    text?: string;
}

export interface NotificationProvider {
    initialize(): Promise<void>;
    sendNotification(request: NotificationRequest): Promise<void>;
    onResponse(callback: (response: NotificationResponse) => void): void;
    dispose(): Promise<void>;
}

export function mapClineAskToNotificationType(askType: ClineAsk): NotificationType {
    switch (askType) {
        case 'command':
        case 'tool':
        case 'browser_action_launch':
        case 'use_mcp_server':
            return 'approval';
        case 'followup':
            return 'question';
        default:
            return 'question';
    }
}