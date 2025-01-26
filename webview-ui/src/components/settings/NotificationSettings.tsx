import React, { useEffect, useState } from 'react';
import { vscode } from '../../utils/vscode';

interface NotificationSettings {
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    pollingInterval: number;
  };
}

export const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial settings
    vscode.postMessage({
      type: 'getNotificationSettings'
    });

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'notificationSettings') {
        setSettings(message.settings);
        setLoading(false);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  const handleChange = (section: 'telegram', field: string, value: any) => {
    const newSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        [field]: value
      }
    };
    setSettings(newSettings);

    vscode.postMessage({
      type: 'updateNotificationSettings',
      settings: newSettings
    });
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="notification-settings">
      <h3>Telegram Notifications</h3>
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={settings.telegram?.enabled ?? false}
            onChange={(e) => handleChange('telegram', 'enabled', e.target.checked)}
          />
          Enable Telegram notifications
        </label>

        {settings.telegram?.enabled && (
          <>
            <div className="setting-item">
              <label>Bot Token:</label>
              <input
                type="password"
                value={settings.telegram?.botToken ?? ''}
                onChange={(e) => handleChange('telegram', 'botToken', e.target.value)}
                placeholder="Enter your Telegram bot token"
              />
              <small>
                Create a new bot and get the token from{' '}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                  @BotFather
                </a>
              </small>
            </div>

            <div className="setting-item">
              <label>Chat ID:</label>
              <input
                type="text"
                value={settings.telegram?.chatId ?? ''}
                onChange={(e) => handleChange('telegram', 'chatId', e.target.value)}
                placeholder="Enter your Telegram chat ID"
              />
              <small>
                Start a chat with your bot and send /start to get your chat ID
              </small>
            </div>

            <div className="setting-item">
              <label>Polling Interval (ms):</label>
              <input
                type="number"
                value={settings.telegram?.pollingInterval ?? 1000}
                onChange={(e) => handleChange('telegram', 'pollingInterval', parseInt(e.target.value))}
                min="500"
                max="5000"
              />
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .notification-settings {
          padding: 1rem;
        }
        .setting-group {
          margin: 1rem 0;
          padding: 1rem;
          border: 1px solid var(--vscode-input-border);
          border-radius: 4px;
        }
        .setting-item {
          margin: 1rem 0;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
        }
        input[type="text"],
        input[type="password"],
        input[type="number"] {
          width: 100%;
          padding: 0.5rem;
          margin-bottom: 0.25rem;
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
        }
        small {
          display: block;
          color: var(--vscode-descriptionForeground);
          margin-top: 0.25rem;
        }
        a {
          color: var(--vscode-textLink-foreground);
        }
      `}</style>
    </div>
  );
};