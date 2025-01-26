import { TelegramProvider } from '../providers/telegramProvider';
import { spawn } from 'child_process';
import * as fs from 'fs';
import fetch from 'node-fetch';

jest.mock('child_process');
jest.mock('fs');
jest.mock('node-fetch');

describe('TelegramProvider', () => {
    const mockConfig = {
        botToken: 'test-token',
        chatId: 'test-chat-id',
        pollingInterval: 30
    };

    let provider: TelegramProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        provider = new TelegramProvider(mockConfig);
    });

    afterEach(async () => {
        await provider.dispose();
    });

    describe('initialize', () => {
        it('should set up webhook when ngrok is available', async () => {
            // Mock successful ngrok startup
            const mockNgrok = {
                stdout: {
                    on: jest.fn((event, callback) => {
                        if (event === 'data') {
                            callback('Forwarding https://test.ngrok.io -> localhost:3000');
                        }
                    })
                },
                kill: jest.fn()
            };
            (spawn as jest.Mock).mockReturnValue(mockNgrok);

            // Mock successful webhook setup
            (fetch as unknown as jest.Mock).mockResolvedValue({ ok: true });

            await provider.initialize();

            // Verify ngrok was started
            expect(spawn).toHaveBeenCalledWith('ngrok', ['http', '3000']);

            // Verify webhook was set
            expect(fetch).toHaveBeenCalledWith(
                'https://api.telegram.org/bottest-token/setWebhook',
                expect.any(Object)
            );
        });

        it('should fall back to polling when webhook setup fails', async () => {
            // Mock ngrok failure
            (spawn as jest.Mock).mockImplementation(() => {
                throw new Error('ngrok not found');
            });

            // Mock Python check
            (spawn as jest.Mock).mockImplementationOnce((cmd, args) => ({
                on: (event: string, callback: (code: number) => void) => {
                    if (event === 'close') callback(0);
                }
            }));

            // Mock polling process
            const mockPolling = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                kill: jest.fn()
            };
            (spawn as jest.Mock).mockReturnValue(mockPolling);

            await provider.initialize();

            // Verify Python dependencies were checked
            expect(spawn).toHaveBeenCalledWith('python3', ['-c', 'import requests']);

            // Verify polling script was created
            expect(fs.writeFileSync).toHaveBeenCalled();

            // Verify polling was started
            expect(spawn).toHaveBeenCalledWith('python3', expect.any(Array));
        });
    });

    describe('sendNotification', () => {
        it('should send formatted messages to Telegram API', async () => {
            (fetch as unknown as jest.Mock).mockResolvedValue({ ok: true });

            await provider.sendNotification({
                type: 'approval',
                message: 'Test message',
                requestId: 'test-id',
                metadata: {
                    toolName: 'test-tool',
                    path: 'test/path',
                    command: 'test command'
                }
            });

            expect(fetch).toHaveBeenCalledWith(
                'https://api.telegram.org/bottest-token/sendMessage',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            );

            // Verify message formatting
            const callArgs = (fetch as unknown as jest.Mock).mock.calls[0][1];
            const body = JSON.parse(callArgs.body);
            expect(body.text).toContain('🔐 *Approval Required*');
            expect(body.text).toContain('Tool: `test-tool`');
            expect(body.text).toContain('Path: `test/path`');
            expect(body.text).toContain('Command: `test command`');
            expect(body.text).toContain('Test message');
        });

        it('should handle API errors', async () => {
            (fetch as unknown as jest.Mock).mockResolvedValue({ 
                ok: false, 
                statusText: 'Bad Request' 
            });

            await expect(provider.sendNotification({
                type: 'question',
                message: 'Test message',
                requestId: 'test-id'
            })).rejects.toThrow('Telegram API error: Bad Request');
        });
    });

    describe('dispose', () => {
        it('should clean up all processes and webhook', async () => {
            const mockProcesses = {
                kill: jest.fn()
            };
            (spawn as jest.Mock).mockReturnValue(mockProcesses);
            
            // Set up provider with webhook
            (fetch as unknown as jest.Mock).mockResolvedValue({ ok: true });
            await provider.initialize();

            // Reset fetch mock for dispose call
            (fetch as unknown as jest.Mock).mockClear();

            // Dispose
            await provider.dispose();

            // Verify webhook was deleted
            expect(fetch).toHaveBeenCalledWith(
                'https://api.telegram.org/bottest-token/deleteWebhook'
            );

            // Verify processes were killed
            expect(mockProcesses.kill).toHaveBeenCalled();
        });
    });
});