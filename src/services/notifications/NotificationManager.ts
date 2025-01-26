import { NotificationProvider, NotificationRequest, NotificationResponse, NotificationType } from './types';
import { TelegramProvider } from './providers/telegramProvider';
import { ClineAsk } from '../../shared/ExtensionMessage';
import { mapClineAskToNotificationType } from './types';
import { logger } from '../../utils/logger';

interface NotificationSettings {
    telegram?: {
        enabled: boolean;
        botToken: string;
        chatId: string;
        pollingInterval: number;
    };
}

export class NotificationManager {
    private static instance: NotificationManager;
    private provider?: NotificationProvider;
    private pendingRequests: Map<string, (response: NotificationResponse) => void> = new Map();

    private constructor() {}

    public static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    public async initialize(settings: NotificationSettings): Promise<void> {
        // Clean up existing provider if any
        if (this.provider) {
            await this.provider.dispose();
            this.provider = undefined;
        }

        // Initialize new provider if enabled
        if (settings.telegram?.enabled) {
            try {
                const provider = new TelegramProvider({
                    botToken: settings.telegram.botToken,
                    chatId: settings.telegram.chatId,
                    pollingInterval: settings.telegram.pollingInterval
                });

                // Set up response handler
                provider.onResponse((response) => {
                    const resolver = this.pendingRequests.get(response.requestId);
                    if (resolver) {
                        resolver(response);
                        this.pendingRequests.delete(response.requestId);
                    }
                });

                await provider.initialize();
                this.provider = provider;
            } catch (error) {
                logger.error('Failed to initialize notification provider:', error);
                throw error;
            }
        }
    }

    public async notifyFromClineAsk(
        askType: ClineAsk,
        text: string,
        metadata?: {
            toolName?: string;
            path?: string;
            command?: string;
        }
    ): Promise<NotificationResponse> {
        if (!this.provider) {
            throw new Error('No notification provider initialized');
        }

        const notificationType = mapClineAskToNotificationType(askType);
        const requestId = Math.random().toString(36).substring(7);

        // Create a promise that will resolve when we get a response
        const responsePromise = new Promise<NotificationResponse>((resolve) => {
            this.pendingRequests.set(requestId, resolve);
        });

        // Send the notification
        await this.provider.sendNotification({
            type: notificationType,
            message: text,
            requestId,
            metadata
        });

        // Wait for response
        return responsePromise;
    }

    public async dispose(): Promise<void> {
        if (this.provider) {
            await this.provider.dispose();
            this.provider = undefined;
        }
        this.pendingRequests.clear();
    }
}