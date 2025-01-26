import { NotificationProvider, NotificationRequest, NotificationResponse, NotificationType } from './types';
import { TelegramProvider } from './providers/telegramProvider';
import { logger } from '../../utils/logger';
import { ClineAsk } from '../../shared/ExtensionMessage';
import { mapClineAskToNotificationType } from './types';

export interface NotificationManagerConfig {
    telegram?: {
        enabled: boolean;
        botToken: string;
        chatId: string;
        pollingInterval: number;
    };
}

export class NotificationManager {
    private static instance: NotificationManager;
    private providers: Map<string, NotificationProvider>;
    private config: NotificationManagerConfig;
    private pendingRequests: Map<string, (response: NotificationResponse) => void>;

    private constructor() {
        this.providers = new Map();
        this.config = {};
        this.pendingRequests = new Map();
    }

    static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    async initialize(config: NotificationManagerConfig): Promise<void> {
        this.config = config;

        // Clear existing providers
        for (const provider of this.providers.values()) {
            await provider.dispose();
        }
        this.providers.clear();

        // Initialize Telegram provider if enabled
        if (config.telegram?.enabled) {
            try {
                const telegramProvider = new TelegramProvider({
                    botToken: config.telegram.botToken,
                    chatId: config.telegram.chatId,
                    pollingInterval: config.telegram.pollingInterval
                });

                await telegramProvider.initialize();
                
                // Set up response handling
                telegramProvider.onResponse((response: NotificationResponse) => {
                    const handler = this.pendingRequests.get(response.requestId);
                    if (handler) {
                        handler(response);
                        this.pendingRequests.delete(response.requestId);
                    }
                });

                this.providers.set('telegram', telegramProvider);
                logger.info('Telegram notification provider initialized');
            } catch (error) {
                logger.error('Failed to initialize Telegram provider:', error);
                throw error;
            }
        }
    }

    async notify(
        type: NotificationType,
        message: string,
        metadata?: {
            toolName?: string;
            path?: string;
            command?: string;
        }
    ): Promise<NotificationResponse> {
        const requestId = crypto.randomUUID();
        const request: NotificationRequest = {
            type,
            message,
            requestId,
            metadata
        };

        // Send to all active providers
        const errors: Error[] = [];
        for (const [name, provider] of this.providers.entries()) {
            try {
                await provider.sendNotification(request);
                logger.info(`Notification sent via ${name} provider`);
            } catch (error) {
                logger.error(`Failed to send notification via ${name} provider:`, error);
                errors.push(error as Error);
            }
        }

        // If all providers failed, throw an error
        if (errors.length === this.providers.size) {
            throw new Error('All notification providers failed');
        }

        // Wait for response
        return new Promise((resolve) => {
            this.pendingRequests.set(requestId, resolve);
        });
    }

    async notifyFromClineAsk(
        askType: ClineAsk,
        message: string,
        metadata?: {
            toolName?: string;
            path?: string;
            command?: string;
        }
    ): Promise<NotificationResponse> {
        const notificationType = mapClineAskToNotificationType(askType);
        return this.notify(notificationType, message, metadata);
    }

    async dispose(): Promise<void> {
        // Dispose all providers
        for (const provider of this.providers.values()) {
            await provider.dispose();
        }
        this.providers.clear();
        this.pendingRequests.clear();
    }

    getConfig(): NotificationManagerConfig {
        return this.config;
    }
}