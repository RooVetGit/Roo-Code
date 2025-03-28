import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserSession } from '../BrowserSession';
import { BrowserActionResult } from '../../../shared/ExtensionMessage';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('puppeteer-core');
jest.mock('p-wait-for');
jest.mock('delay');

describe('BrowserSession Upload Tests', () => {
  let browserSession: BrowserSession;
  let mockContext: vscode.ExtensionContext;
  let mockPage: any;
  
  const testFilePath = path.join(__dirname, '../../../../e2e/fixtures/test-upload-file.txt');
  
  beforeEach(() => {
    // Create a mock extension context
    mockContext = {
      globalState: {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'browserViewportSize') return '1280x800';
          if (key === 'screenshotQuality') return 75;
          return undefined;
        }),
      },
      globalStorageUri: { fsPath: '/mock/storage/path' },
    } as unknown as vscode.ExtensionContext;
    
    // Create a mock page
    mockPage = {
      screenshot: jest.fn().mockResolvedValue(Buffer.from('mockScreenshot')),
      content: jest.fn().mockResolvedValue('<html><body><input type="file" id="fileInput"></body></html>'),
      url: jest.fn().mockReturnValue('http://example.com'),
      $: jest.fn().mockResolvedValue({
        uploadFile: jest.fn().mockResolvedValue(undefined),
      }),
      $$: jest.fn().mockResolvedValue([{
        uploadFile: jest.fn().mockResolvedValue(undefined),
      }]),
      evaluate: jest.fn().mockImplementation((fn, ...args) => {
        // Mock the evaluate function to return different values based on the function passed
        if (fn.toString().includes('document.body.innerText')) {
          return 'success upload complete';
        }
        return { originalDisplay: 'none', originalVisibility: 'hidden', originalPosition: 'absolute' };
      }),
      on: jest.fn(),
      off: jest.fn(),
      waitForFileChooser: jest.fn().mockResolvedValue({
        accept: jest.fn().mockResolvedValue(undefined),
      }),
      click: jest.fn().mockResolvedValue(undefined),
    };
    
    // Create the browser session with mocked context
    browserSession = new BrowserSession(mockContext);
    
    // Mock the doAction method to use our mock page
    (browserSession as any).doAction = jest.fn().mockImplementation(async (action) => {
      await action(mockPage);
      return {
        screenshot: 'data:image/png;base64,mockScreenshot',
        logs: 'File uploaded successfully',
        currentUrl: 'http://example.com',
        currentMousePosition: '100,100',
      };
    });
    
    // Mock fs.access to simulate file existence check
    (fs.promises.access as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });
  
  test('upload method should upload a file to a standard file input', async () => {
    // Call the upload method
    const result = await browserSession.upload('#fileInput', testFilePath);
    
    // Verify the doAction method was called
    expect((browserSession as any).doAction).toHaveBeenCalled();
    
    // Verify the result structure
    expect(result).toHaveProperty('screenshot');
    expect(result).toHaveProperty('logs');
    expect(result).toHaveProperty('currentUrl');
    expect(result).toHaveProperty('currentMousePosition');
  });
  
  test('upload method should throw an error if the file does not exist', async () => {
    // Mock fs.access to throw an error
    (fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'));
    
    // Call the upload method and expect it to throw
    await expect(browserSession.upload('#fileInput', 'non-existent-file.txt')).rejects.toThrow();
  });
  
  test('upload method should handle hidden file inputs', async () => {
    // Mock the page.$ method to return a hidden file input
    mockPage.$ = jest.fn().mockResolvedValue({
      uploadFile: jest.fn().mockResolvedValue(undefined),
    });
    
    // Call the upload method
    const result = await browserSession.upload('#hiddenFileInput', testFilePath);
    
    // Verify the doAction method was called
    expect((browserSession as any).doAction).toHaveBeenCalled();
    
    // Verify the result structure
    expect(result).toHaveProperty('screenshot');
    expect(result).toHaveProperty('logs');
  });
  
  test('upload method should fall back to FileChooser API if direct method fails', async () => {
    // Mock the page.$ method to return null to simulate direct method failure
    mockPage.$ = jest.fn().mockResolvedValue(null);
    
    // Call the upload method
    const result = await browserSession.upload('#fileInput', testFilePath);
    
    // Verify the doAction method was called
    expect((browserSession as any).doAction).toHaveBeenCalled();
    
    // Verify the result structure
    expect(result).toHaveProperty('screenshot');
    expect(result).toHaveProperty('logs');
  });
  
  test('upload method should throw an error if no file input elements are found', async () => {
    // Mock the page.$$ method to return an empty array
    mockPage.$$ = jest.fn().mockResolvedValue([]);
    
    // Call the upload method and expect it to throw
    await expect(browserSession.upload('#fileInput', testFilePath)).rejects.toThrow();
  });
});