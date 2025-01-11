import axios from 'axios';
import * as vscode from 'vscode';

export interface MessagingConfig {
    telegramBotToken?: string;
    telegramChatId?: string;  // Keep as string in config, convert to number when sending
    notificationsEnabled?: boolean;
}

export class MessagingService {
    private config: MessagingConfig;

    constructor(config: MessagingConfig) {
        console.log("[DEBUG] Initializing MessagingService with config:", config);
        this.config = config;
    }

    async sendTelegramMessage(message: string): Promise<boolean> {
        if (!this.config.telegramBotToken || !this.config.telegramChatId || !this.config.notificationsEnabled) {
            return false;
        }

        try {
            const chatId = parseInt(this.config.telegramChatId, 10);
            if (isNaN(chatId)) {
                console.error('Invalid Telegram chat ID - must be a number');
                return false;
            }

            await axios.post(`https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
            return true;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Failed to send Telegram message:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message
                });
            } else {
                console.error('Failed to send Telegram message:', error);
            }
            return false;
        }
    }

    private formatMessage(message: string): string {
        const timestamp = new Date().toLocaleString();
        return `🚀 *Task Completed!*\n\n📝 Task: ${message}\n\n⏰ Time: ${timestamp}`;
    }

    async notifyAll(message: string): Promise<void> {
        if (!this.config.notificationsEnabled) {
            return;
        }

        const formattedMessage = this.formatMessage(message);
        const result = await this.sendTelegramMessage(formattedMessage);
        
        if (!result) {
            console.error('Failed to send Telegram notification');
        }
    }
}