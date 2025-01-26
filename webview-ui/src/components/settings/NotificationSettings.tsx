import React, { useEffect, useState } from 'react';
import { TextField, Switch, Stack, Typography } from '@mui/material';
import { vscode } from '../../utils/vscode';

interface TelegramSettings {
    enabled: boolean;
    botToken: string;
    chatId: string;
    pollingInterval: number;
}

interface NotificationSettings {
    telegram?: TelegramSettings;
}

export const NotificationSettings: React.FC = () => {
    const [settings, setSettings] = useState<NotificationSettings>({
        telegram: {
            enabled: false,
            botToken: '',
            chatId: '',
            pollingInterval: 30
        }
    });

    useEffect(() => {
        // Request current settings when component mounts
        vscode.postMessage({
            type: 'getNotificationSettings'
        });
    }, []);

    useEffect(() => {
        // Handle settings updates from extension
        const messageHandler = (event: MessageEvent<any>) => {
            const message = event.data;
            if (message.type === 'notificationSettings') {
                setSettings(message.settings);
            }
        };

        window.addEventListener('message', messageHandler);
        return () => window.removeEventListener('message', messageHandler);
    }, []);

    const handleSettingChange = (
        path: string[],
        value: string | boolean | number
    ) => {
        const newSettings = { ...settings };
        let current: any = newSettings;
        
        // Navigate to the correct nested object
        for (let i = 0; i < path.length - 1; i++) {
            if (!current[path[i]]) {
                current[path[i]] = {};
            }
            current = current[path[i]];
        }
        
        // Set the value
        current[path[path.length - 1]] = value;
        
        // Update local state
        setSettings(newSettings);
        
        // Send update to extension
        vscode.postMessage({
            type: 'updateNotificationSettings',
            settings: newSettings
        });
    };

    return (
        <Stack spacing={3} sx={{ padding: 2 }}>
            <Typography variant="h6">Notification Settings</Typography>
            
            <Stack spacing={2}>
                <Typography variant="subtitle1">Telegram</Typography>
                
                <Switch
                    checked={settings.telegram?.enabled ?? false}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        handleSettingChange(['telegram', 'enabled'], e.target.checked)
                    }
                    inputProps={{ 'aria-label': 'Enable Telegram notifications' }}
                />
                
                {settings.telegram?.enabled && (
                    <>
                        <TextField
                            label="Bot Token"
                            value={settings.telegram?.botToken ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                                handleSettingChange(['telegram', 'botToken'], e.target.value)
                            }
                            fullWidth
                            type="password"
                            helperText="Your Telegram bot token from @BotFather"
                        />
                        
                        <TextField
                            label="Chat ID"
                            value={settings.telegram?.chatId ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                                handleSettingChange(['telegram', 'chatId'], e.target.value)
                            }
                            fullWidth
                            helperText="Your Telegram chat ID (message @userinfobot to get it)"
                        />
                        
                        <TextField
                            label="Polling Interval (seconds)"
                            value={settings.telegram?.pollingInterval ?? 30}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                    handleSettingChange(['telegram', 'pollingInterval'], value);
                                }
                            }}
                            type="number"
                            inputProps={{ min: 1 }}
                            fullWidth
                            helperText="How often to check for responses (in seconds)"
                        />
                    </>
                )}
            </Stack>
        </Stack>
    );
};