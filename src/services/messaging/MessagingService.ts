import axios from 'axios';
import * as vscode from 'vscode';
import { MessagingConfig } from '../../shared/ExtensionMessage';

export class MessagingService {
    private _config: MessagingConfig;

    constructor(config: MessagingConfig) {
        console.log("[DEBUG] Initializing MessagingService with config:", config);
        this._config = config;
    }

    public get config(): MessagingConfig {
        return this._config;
    }

    async sendTelegramMessage(message: string): Promise<boolean> {
        if (!this._config.telegramBotToken || !this._config.telegramChatId || !this._config.notificationsEnabled) {
            console.log("[DEBUG] Skipping Telegram message - missing config:", {
                hasToken: !!this._config.telegramBotToken,
                hasChatId: !!this._config.telegramChatId,
                notificationsEnabled: !!this._config.notificationsEnabled
            });
            return false;
        }

        try {
            const chatId = parseInt(this._config.telegramChatId, 10);
            if (isNaN(chatId)) {
                throw new Error('Invalid Telegram chat ID - must be a number');
            }

            // First verify the bot token by getting bot info
            try {
                await axios.get(`https://api.telegram.org/bot${this._config.telegramBotToken}/getMe`);
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    throw new Error('Invalid Telegram bot token');
                }
                throw error;
            }

            // Then try to send the message
            const response = await axios.post(`https://api.telegram.org/bot${this._config.telegramBotToken}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });

            console.log("[DEBUG] Telegram message sent successfully:", response.status);
            return true;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('[ERROR] Failed to send Telegram message:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message
                });
                
                if (error.response?.status === 401) {
                    throw new Error('Invalid bot token - please check your configuration');
                } else if (error.response?.status === 400) {
                    throw new Error('Invalid chat ID - please verify your Telegram chat ID');
                } else if (error.response?.status === 403) {
                    throw new Error('Bot was blocked by the user or chat - please restart the chat with your bot');
                }
            }
            
            // Re-throw the error to be handled by the caller
            throw error;
        }
    }

    private formatMessage(message: string): string {
        // Message format is: "Task: <task>\n\nResult:\n<result>"
        const [taskPart, resultPart] = message.split('\n\nResult:\n');
        const task = taskPart.replace('Task: ', '');
        const timestamp = new Date().toLocaleString();
        
        let formattedMessage = `🚀 *Task Completed!*\n\n📝 Task: ${task}\n\n⏰ Time: ${timestamp}`;
        if (resultPart) {
            formattedMessage += `\n\n✅ Result:\n${resultPart}`;
        }
        return formattedMessage;
    }

    async notifyAll(message: string, type: 'task_completion' | 'error_state' | 'request_failed' | 'shell_warning' | 'followup_question' | 'user_feedback' | 'diff_feedback'): Promise<void> {
        if (!this._config.notificationsEnabled) {
            console.log("[DEBUG] Notifications are disabled, skipping notification");
            return;
        }

        if (!this._config.telegramBotToken || !this._config.telegramChatId) {
            console.log("[DEBUG] Missing Telegram configuration, skipping notification");
            return;
        }

        // Check if this notification type is enabled
        const shouldNotify = (() => {
            switch (type) {
                case 'task_completion':
                    return this._config.notifyOnTaskCompletion ?? true;
                case 'error_state':
                    return this._config.notifyOnErrorStates ?? true;
                case 'request_failed':
                    return this._config.notifyOnRequestFailed ?? false;
                case 'shell_warning':
                    return this._config.notifyOnShellWarnings ?? false;
                case 'followup_question':
                    return this._config.notifyOnFollowupQuestions ?? false;
                case 'user_feedback':
                    return this._config.notifyOnUserFeedback ?? false;
                case 'diff_feedback':
                    return this._config.notifyOnDiffFeedback ?? false;
            }
        })();

        if (!shouldNotify) {
            console.log(`[DEBUG] Notifications for ${type} are disabled, skipping notification`);
            return;
        }

        try {
            const formattedMessage = this.formatMessage(message);
            await this.sendTelegramMessage(formattedMessage);
            console.log("[DEBUG] Notification sent successfully");
        } catch (error) {
            console.error('[ERROR] Failed to send notification:', error);
            // Don't throw the error - we don't want to interrupt the task completion flow
            // The error has already been shown to the user when testing the config
        }
    }
}