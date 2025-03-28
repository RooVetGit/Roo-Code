import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Cline } from '../Cline';
import { BrowserSession } from '../../services/browser/BrowserSession';
import { formatResponse } from '../prompts/responses';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../services/browser/BrowserSession');
jest.mock('../prompts/responses');

describe('Cline Browser Action Upload Tests', () => {
  let cline: Cline;
  let mockProvider: any;
  let mockBrowserSession: jest.Mocked<BrowserSession>;
  
  const testFilePath = path.join(__dirname, '../../../e2e/fixtures/test-upload-file.txt');
  
  beforeEach(() => {
    // Mock the provider
    mockProvider = {
      context: {
        globalState: {
          get: jest.fn(),
        },
        globalStorageUri: { fsPath: '/mock/storage/path' },
      },
      postStateToWebview: jest.fn(),
      getState: jest.fn().mockResolvedValue({
        mode: 'code',
        customModes: [],
      }),
    };
    
    // Create a weak reference to the provider
    const mockWeakRef = {
      deref: jest.fn().mockReturnValue(mockProvider),
    };
    
    // Mock the BrowserSession
    mockBrowserSession = new BrowserSession(mockProvider.context) as jest.Mocked<BrowserSession>;
    mockBrowserSession.upload = jest.fn().mockResolvedValue({
      screenshot: 'data:image/png;base64,mockScreenshot',
      logs: 'File uploaded successfully',
    });
    
    // Mock formatResponse
    (formatResponse.toolResult as jest.Mock).mockReturnValue('Tool result');
    (formatResponse.toolError as jest.Mock).mockReturnValue('Tool error');
    
    // Create the Cline instance
    cline = new Cline({
      provider: mockProvider as any,
      apiConfiguration: { apiProvider: 'anthropic', apiKey: 'mock-key' },
      startTask: false,
    });
    
    // Set the browser session
    (cline as any).browserSession = mockBrowserSession;
    
    // Mock the say method
    (cline as any).say = jest.fn();
    
    // Mock the ask method
    (cline as any).ask = jest.fn().mockResolvedValue({
      response: 'yesButtonClicked',
    });
    
    // Mock fs.access to simulate file existence check
    (fs.access as jest.Mock).mockResolvedValue(undefined);
  });
  
  test('browser_action upload should call BrowserSession.upload with correct parameters', async () => {
    // Create a mock tool use block for upload
    const uploadBlock = {
      type: 'tool_use',
      name: 'browser_action',
      params: {
        action: 'upload',
        selector: '#fileInput',
        filepath: testFilePath,
      },
      partial: false,
    };
    
    // Create a mock pushToolResult function
    const pushToolResult = jest.fn();
    
    // Call the presentAssistantMessage method with the upload block
    await (cline as any).presentAssistantMessage(uploadBlock, pushToolResult);
    
    // Verify the browser session upload method was called with the correct parameters
    expect(mockBrowserSession.upload).toHaveBeenCalledWith('#fileInput', testFilePath);
    
    // Verify the say method was called
    expect((cline as any).say).toHaveBeenCalled();
    
    // Verify the pushToolResult function was called
    expect(pushToolResult).toHaveBeenCalled();
  });
  
  test('browser_action upload should handle missing selector parameter', async () => {
    // Create a mock tool use block with missing selector
    const uploadBlock = {
      type: 'tool_use',
      name: 'browser_action',
      params: {
        action: 'upload',
        filepath: testFilePath,
      },
      partial: false,
    };
    
    // Create a mock pushToolResult function
    const pushToolResult = jest.fn();
    
    // Mock the sayAndCreateMissingParamError method
    (cline as any).sayAndCreateMissingParamError = jest.fn().mockResolvedValue('Missing selector parameter');
    
    // Call the presentAssistantMessage method with the upload block
    await (cline as any).presentAssistantMessage(uploadBlock, pushToolResult);
    
    // Verify the sayAndCreateMissingParamError method was called
    expect((cline as any).sayAndCreateMissingParamError).toHaveBeenCalledWith('browser_action', 'selector');
    
    // Verify the pushToolResult function was called with the error
    expect(pushToolResult).toHaveBeenCalledWith('Missing selector parameter');
    
    // Verify the browser session closeBrowser method was called
    expect(mockBrowserSession.closeBrowser).toHaveBeenCalled();
  });
  
  test('browser_action upload should handle missing filepath parameter', async () => {
    // Create a mock tool use block with missing filepath
    const uploadBlock = {
      type: 'tool_use',
      name: 'browser_action',
      params: {
        action: 'upload',
        selector: '#fileInput',
      },
      partial: false,
    };
    
    // Create a mock pushToolResult function
    const pushToolResult = jest.fn();
    
    // Mock the sayAndCreateMissingParamError method
    (cline as any).sayAndCreateMissingParamError = jest.fn().mockResolvedValue('Missing filepath parameter');
    
    // Call the presentAssistantMessage method with the upload block
    await (cline as any).presentAssistantMessage(uploadBlock, pushToolResult);
    
    // Verify the sayAndCreateMissingParamError method was called
    expect((cline as any).sayAndCreateMissingParamError).toHaveBeenCalledWith('browser_action', 'filepath');
    
    // Verify the pushToolResult function was called with the error
    expect(pushToolResult).toHaveBeenCalledWith('Missing filepath parameter');
    
    // Verify the browser session closeBrowser method was called
    expect(mockBrowserSession.closeBrowser).toHaveBeenCalled();
  });
  
  test('browser_action upload should handle non-existent file', async () => {
    // Mock fs.access to throw an error
    (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));
    
    // Create a mock tool use block
    const uploadBlock = {
      type: 'tool_use',
      name: 'browser_action',
      params: {
        action: 'upload',
        selector: '#fileInput',
        filepath: 'non-existent-file.txt',
      },
      partial: false,
    };
    
    // Create a mock pushToolResult function
    const pushToolResult = jest.fn();
    
    // Call the presentAssistantMessage method with the upload block
    await (cline as any).presentAssistantMessage(uploadBlock, pushToolResult);
    
    // Verify the say method was called with an error
    expect((cline as any).say).toHaveBeenCalledWith('error', expect.stringContaining('File not found'));
    
    // Verify the pushToolResult function was called with an error
    expect(pushToolResult).toHaveBeenCalled();
    expect(formatResponse.toolError).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    
    // Verify the browser session closeBrowser method was called
    expect(mockBrowserSession.closeBrowser).toHaveBeenCalled();
  });
  
  test('browser_action upload should handle upload errors', async () => {
    // Mock the browser session upload method to throw an error
    mockBrowserSession.upload.mockRejectedValue(new Error('Upload failed'));
    
    // Create a mock tool use block
    const uploadBlock = {
      type: 'tool_use',
      name: 'browser_action',
      params: {
        action: 'upload',
        selector: '#fileInput',
        filepath: testFilePath,
      },
      partial: false,
    };
    
    // Create a mock pushToolResult function
    const pushToolResult = jest.fn();
    
    // Call the presentAssistantMessage method with the upload block
    await (cline as any).presentAssistantMessage(uploadBlock, pushToolResult);
    
    // Verify the say method was called with an error
    expect((cline as any).say).toHaveBeenCalledWith('error', expect.stringContaining('Upload failed'));
    
    // Verify the pushToolResult function was called with an error
    expect(pushToolResult).toHaveBeenCalled();
    expect(formatResponse.toolError).toHaveBeenCalledWith(expect.stringContaining('Upload failed'));
    
    // Verify the browser session closeBrowser method was called
    expect(mockBrowserSession.closeBrowser).toHaveBeenCalled();
  });
});