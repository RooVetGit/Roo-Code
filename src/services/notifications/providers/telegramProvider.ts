import { NotificationProvider, NotificationRequest, NotificationResponse } from '../types';
import { logger } from '../../../utils/logger';
import { spawn } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

interface TelegramConfig {
    botToken: string;
    chatId: string;
    pollingInterval: number;
}

export class TelegramProvider implements NotificationProvider {
    private config: TelegramConfig;
    private responseCallback?: (response: NotificationResponse) => void;
    private pollingProcess?: ReturnType<typeof spawn>;
    private ngrokProcess?: ReturnType<typeof spawn>;
    private webhookUrl?: string;

    constructor(config: TelegramConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        // Try to set up ngrok for webhooks
        try {
            this.ngrokProcess = spawn('ngrok', ['http', '3000']);
            
            // Wait for ngrok to start and get the public URL
            await new Promise<void>((resolve, reject) => {
                let output = '';
                this.ngrokProcess?.stdout?.on('data', (data) => {
                    output += data.toString();
                    const match = output.match(/https:\/\/[^\.]+\.ngrok\.io/);
                    if (match) {
                        this.webhookUrl = match[0] + '/telegram-webhook';
                        resolve();
                    }
                });

                // Timeout after 10 seconds
                setTimeout(() => reject(new Error('Ngrok startup timeout')), 10000);
            });

            // Set up webhook
            await fetch(`https://api.telegram.org/bot${this.config.botToken}/setWebhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: this.webhookUrl })
            });

            logger.info('Telegram webhook set up successfully');
        } catch (error) {
            logger.warn('Failed to set up Telegram webhook, falling back to polling:', error);
            this.startPolling();
        }
    }

    private startPolling(): void {
        // Create a simple Python script for polling
        const script = `
import os
import time
import json
import requests
from datetime import datetime, timedelta

BOT_TOKEN = '${this.config.botToken}'
CHAT_ID = '${this.config.chatId}'
POLL_INTERVAL = ${this.config.pollingInterval}

last_update_id = 0

while True:
    try:
        response = requests.get(
            f'https://api.telegram.org/bot{BOT_TOKEN}/getUpdates',
            params={'offset': last_update_id + 1, 'timeout': 30}
        )
        updates = response.json().get('result', [])
        
        for update in updates:
            last_update_id = update['update_id']
            message = update.get('message', {})
            
            if str(message.get('chat', {}).get('id')) != CHAT_ID:
                continue
                
            text = message.get('text', '').lower()
            
            # Look for response markers in the message
            if text == 'approve':
                print(json.dumps({
                    'type': 'approve',
                    'requestId': 'pending'  # Will be matched by message proximity
                }))
            elif text == 'deny':
                print(json.dumps({
                    'type': 'deny',
                    'requestId': 'pending'
                }))
            else:
                print(json.dumps({
                    'type': 'text',
                    'text': text,
                    'requestId': 'pending'
                }))
                
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        time.sleep(POLL_INTERVAL)
        continue

    time.sleep(POLL_INTERVAL)
`;

        // Save script to temporary file
        const fs = require('fs');
        const path = require('path');
        const scriptPath = path.join(os.tmpdir(), 'telegram-poll.py');
        fs.writeFileSync(scriptPath, script);

        // Start polling process
        this.pollingProcess = spawn('python3', [scriptPath]);

        // Handle responses
        this.pollingProcess.stdout?.on('data', (data) => {
            try {
                const response = JSON.parse(data.toString());
                if (this.responseCallback) {
                    this.responseCallback(response);
                }
            } catch (error) {
                logger.error('Error parsing polling response:', error);
            }
        });

        this.pollingProcess.stderr?.on('data', (data) => {
            logger.error('Polling error:', data.toString());
        });
    }

    async sendNotification(request: NotificationRequest): Promise<void> {
        const message = this.formatMessage(request);
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.config.chatId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });

            if (!response.ok) {
                throw new Error(`Telegram API error: ${response.statusText}`);
            }
        } catch (error) {
            logger.error('Failed to send Telegram notification:', error);
            throw error;
        }
    }

    private formatMessage(request: NotificationRequest): string {
        let message = '';

        // Add context about what's being requested
        if (request.type === 'approval') {
            message += '🔐 *Approval Required*\n\n';
            if (request.metadata?.toolName) {
                message += `Tool: \`${request.metadata.toolName}\`\n`;
            }
            if (request.metadata?.path) {
                message += `Path: \`${request.metadata.path}\`\n`;
            }
            if (request.metadata?.command) {
                message += `Command: \`${request.metadata.command}\`\n`;
            }
            message += '\nReply with `approve` or `deny`\n\n';
        } else {
            message += '❓ *Question*\n\n';
            message += 'Reply with your answer\n\n';
        }

        // Add the actual message
        message += `${request.message}`;

        return message;
    }

    onResponse(callback: (response: NotificationResponse) => void): void {
        this.responseCallback = callback;
    }

    async dispose(): Promise<void> {
        // Clean up webhook if it was set
        if (this.webhookUrl) {
            try {
                await fetch(`https://api.telegram.org/bot${this.config.botToken}/deleteWebhook`);
            } catch (error) {
                logger.error('Error cleaning up webhook:', error);
            }
        }

        // Kill polling process if it exists
        if (this.pollingProcess) {
            this.pollingProcess.kill();
        }

        // Kill ngrok process if it exists
        if (this.ngrokProcess) {
            this.ngrokProcess.kill();
        }
    }
}