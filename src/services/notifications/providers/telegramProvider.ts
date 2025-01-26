import { NotificationProvider, NotificationRequest, NotificationResponse } from '../types';
import { logger } from '../../../utils/logger';
import axios from 'axios';
import { spawn } from 'child_process';

interface TelegramConfig {
    botToken: string;
    chatId: string;
    pollingInterval: number;
}

export class TelegramProvider implements NotificationProvider {
    private config: TelegramConfig;
    private ngrokProcess?: ReturnType<typeof spawn>;
    private pollingInterval?: NodeJS.Timeout;
    private responseCallback?: (response: NotificationResponse) => void;
    private requestMap: Map<string, NotificationRequest>;

    constructor(config: TelegramConfig) {
        this.config = config;
        this.requestMap = new Map();
    }

    async initialize(): Promise<void> {
        // Start ngrok for local tunneling
        this.ngrokProcess = spawn('ngrok', ['http', '3000']);
        
        this.ngrokProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            const publicUrlMatch = output.match(/https:\/\/.*\.ngrok\.io/);
            if (publicUrlMatch) {
                this.setWebhook(publicUrlMatch[0]);
            }
        });

        // Start polling for responses
        this.pollingInterval = setInterval(async () => {
            try {
                const response = await axios.get(
                    `https://api.telegram.org/bot${this.config.botToken}/getUpdates`,
                    { params: { offset: -1 } }
                );
                
                response.data.result?.forEach((update: any) => {
                    if (update.message?.text) {
                        this.handleTelegramResponse(update.message.text);
                    }
                });
            } catch (error) {
                logger.error('Telegram polling error:', error);
            }
        }, this.config.pollingInterval * 1000);
    }

    async sendNotification(request: NotificationRequest): Promise<void> {
        try {
            // Store request for later matching with response
            this.requestMap.set(request.requestId, request);

            // Format message based on notification type
            let message = `*${request.type.toUpperCase()}*\n\n${request.message}`;
            
            if (request.type === 'approval') {
                message += '\n\nReply with `approve` or `deny`';
            }

            if (request.metadata) {
                message += '\n\n*Details:*';
                if (request.metadata.toolName) {
                    message += `\nTool: ${request.metadata.toolName}`;
                }
                if (request.metadata.path) {
                    message += `\nPath: ${request.metadata.path}`;
                }
                if (request.metadata.command) {
                    message += `\nCommand: ${request.metadata.command}`;
                }
            }

            await axios.post(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
                chat_id: this.config.chatId,
                text: message,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            logger.error('Telegram notification failed:', error);
            throw error;
        }
    }

    onResponse(callback: (response: NotificationResponse) => void): void {
        this.responseCallback = callback;
    }

    private handleTelegramResponse(text: string): void {
        if (!this.responseCallback) {
            return;
        }

        // Find the most recent request that hasn't been responded to
        const [requestId, request] = Array.from(this.requestMap.entries())[0] || [];
        if (!requestId || !request) {
            return;
        }

        let response: NotificationResponse;

        if (request.type === 'approval') {
            const lowerText = text.toLowerCase().trim();
            if (lowerText === 'approve') {
                response = { requestId, type: 'approve' };
            } else if (lowerText === 'deny') {
                response = { requestId, type: 'deny' };
            } else {
                return; // Invalid response for approval
            }
        } else {
            response = { requestId, type: 'text', text };
        }

        // Remove the request from the map
        this.requestMap.delete(requestId);
        
        // Send response through callback
        this.responseCallback(response);
    }

    private async setWebhook(ngrokUrl: string): Promise<void> {
        try {
            await axios.post(
                `https://api.telegram.org/bot${this.config.botToken}/setWebhook`,
                { url: `${ngrokUrl}/webhook` }
            );
        } catch (error) {
            logger.error('Failed to set Telegram webhook:', error);
        }
    }

    async dispose(): Promise<void> {
        this.ngrokProcess?.kill();
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        this.requestMap.clear();
    }
}