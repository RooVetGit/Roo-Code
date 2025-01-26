import { NotificationManager } from '../NotificationManager';
import { TelegramProvider } from '../providers/telegramProvider';
import { NotificationResponse } from '../types';

// Mock TelegramProvider
jest.mock('../providers/telegramProvider');

describe('NotificationManager', () => {
    let notificationManager: NotificationManager;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        // Get a fresh instance
        notificationManager = NotificationManager.getInstance();
    });

    afterEach(async () => {
        await notificationManager.dispose();
    });

    it('should be a singleton', () => {
        const instance1 = NotificationManager.getInstance();
        const instance2 = NotificationManager.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('should initialize telegram provider when enabled', async () => {
        const settings = {
            telegram: {
                enabled: true,
                botToken: 'test-token',
                chatId: 'test-chat-id',
                pollingInterval: 30
            }
        };

        await notificationManager.initialize(settings);

        expect(TelegramProvider).toHaveBeenCalledWith({
            botToken: 'test-token',
            chatId: 'test-chat-id',
            pollingInterval: 30
        });
    });

    it('should not initialize provider when disabled', async () => {
        const settings = {
            telegram: {
                enabled: false,
                botToken: 'test-token',
                chatId: 'test-chat-id',
                pollingInterval: 30
            }
        };

        await notificationManager.initialize(settings);

        expect(TelegramProvider).not.toHaveBeenCalled();
    });

    it('should send notifications and handle responses', async () => {
        // Setup mock response
        const mockResponse: NotificationResponse = {
            type: 'approve',
            requestId: 'test-id'
        };

        // Mock provider implementation
        (TelegramProvider as jest.Mock).mockImplementation(() => ({
            initialize: jest.fn(),
            sendNotification: jest.fn(),
            onResponse: jest.fn(callback => callback(mockResponse)),
            dispose: jest.fn()
        }));

        // Initialize with settings
        await notificationManager.initialize({
            telegram: {
                enabled: true,
                botToken: 'test-token',
                chatId: 'test-chat-id',
                pollingInterval: 30
            }
        });

        // Send notification and get response
        const response = await notificationManager.notifyFromClineAsk(
            'command',
            'Test message',
            { command: 'test command' }
        );

        expect(response).toEqual(mockResponse);
    });

    it('should clean up provider on dispose', async () => {
        const mockDispose = jest.fn();
        (TelegramProvider as jest.Mock).mockImplementation(() => ({
            initialize: jest.fn(),
            sendNotification: jest.fn(),
            onResponse: jest.fn(),
            dispose: mockDispose
        }));

        await notificationManager.initialize({
            telegram: {
                enabled: true,
                botToken: 'test-token',
                chatId: 'test-chat-id',
                pollingInterval: 30
            }
        });

        await notificationManager.dispose();

        expect(mockDispose).toHaveBeenCalled();
    });
});