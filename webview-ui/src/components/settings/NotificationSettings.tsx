import React from 'react';
import { TextField, Switch, Stack, Typography } from '@mui/material';

interface TelegramSettings {
    enabled: boolean;
    botToken: string;
    chatId: string;
    pollingInterval: number;
}

interface NotificationSettings {
    telegram?: TelegramSettings;
}

interface NotificationSettingsProps {
    settings: NotificationSettings;
    onChange: (settings: NotificationSettings) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ settings, onChange }) => {
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
        
        // Call onChange prop with updated settings
        onChange(newSettings);
    };

    return (
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
    );
};