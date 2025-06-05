import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTestsTool } from '../generateTestsTool';
import type { Task } from '../../task/Task'; // Using type for Task
import type { ToolUse, Anthropic } from '@roo-code/types'; // Using type for ToolUse

// Mock dependencies
// Using vi.hoisted for variables that need to be accessed in vi.mock factory
const { extractSymbolCodeMock, pathExtnameMock } = vi.hoisted(() => {
  return {
    extractSymbolCodeMock: vi.fn(),
    pathExtnameMock: vi.fn(),
  };
});

vi.mock('../../../services/tree-sitter', () => ({
  extractSymbolCode: extractSymbolCodeMock,
}));

vi.mock('path', async () => {
  const actualPath = await vi.importActual<typeof import('path')>('path');
  return {
    ...actualPath,
    extname: pathExtnameMock,
    resolve: vi.fn((...paths) => actualPath.join(...paths)), // Use join for testing consistency
  };
});

// Helper to create an async iterable stream
async function* createMockStream(chunks: Array<{ type: string; text?: string; error?: any }>) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('generateTestsTool', () => {
  let mockCline: Task;
  let mockBlock: ToolUse;
  let mockAskApproval: ReturnType<typeof vi.fn>;
  let mockHandleError: ReturnType<typeof vi.fn>;
  let mockPushToolResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAskApproval = vi.fn();
    mockHandleError = vi.fn();
    mockPushToolResult = vi.fn();

    mockCline = {
      api: {
        createMessage: vi.fn(),
      },
      cwd: '/test/workspace',
      taskId: 'test-task-id',
      // Add other Task properties/methods if generateTestsTool starts using them
    } as unknown as Task; // Cast to Task, acknowledging it's a partial mock

    mockBlock = {
      tool_name: 'generateTestsTool',
      tool_id: 'test-tool-id',
      params: {},
      raw_content: '<tool_use tool_name="generateTestsTool"></tool_use>', // Example raw_content
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test Cases will go here

  it('should call handleError if filePath is missing', async () => {
    mockBlock.params = { symbolName: 'testSymbol' };
    await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);
    expect(mockHandleError).toHaveBeenCalledWith(new Error('Missing required parameter: filePath'));
    expect(mockPushToolResult).not.toHaveBeenCalled();
  });

  it('should call handleError if symbolName is missing', async () => {
    mockBlock.params = { filePath: 'src/test.ts' };
    await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);
    expect(mockHandleError).toHaveBeenCalledWith(new Error('Missing required parameter: symbolName'));
    expect(mockPushToolResult).not.toHaveBeenCalled();
  });

  it('should call handleError if extractSymbolCode returns null (symbol not found)', async () => {
    mockBlock.params = { filePath: 'src/test.ts', symbolName: 'testSymbol' };
    extractSymbolCodeMock.mockResolvedValue(null);
    pathExtnameMock.mockReturnValue('.ts'); // Needed for prompt construction path

    await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

    expect(extractSymbolCodeMock).toHaveBeenCalledWith('/test/workspace/src/test.ts', 'testSymbol', undefined);
    expect(mockHandleError).toHaveBeenCalledWith(
      new Error('Could not extract code for symbol "testSymbol" from src/test.ts. The symbol may not exist, the file type might be unsupported for symbol extraction, or the file itself may not be found.')
    );
    expect(mockPushToolResult).not.toHaveBeenCalled();
  });

  it('happy path: should call pushToolResult with generated tests', async () => {
    const filePath = 'src/component.jsx';
    const symbolName = 'MyComponent';
    const symbolCode = 'const MyComponent = () => <div>Hello</div>;';
    const generatedTestCode = 'describe("MyComponent", () => { it("should render", () => {}); });';

    mockBlock.params = { filePath, symbolName };
    extractSymbolCodeMock.mockResolvedValue(symbolCode);
    pathExtnameMock.mockReturnValue('.jsx');
    (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockStream([{ type: 'text', text: generatedTestCode }])
    );

    await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

    expect(extractSymbolCodeMock).toHaveBeenCalledWith(`/test/workspace/${filePath}`, symbolName, undefined);
    expect(pathExtnameMock).toHaveBeenCalledWith(filePath);
    expect(mockCline.api.createMessage).toHaveBeenCalled();
    expect(mockPushToolResult).toHaveBeenCalledWith(generatedTestCode);
    expect(mockHandleError).not.toHaveBeenCalled();
  });

  it('should call handleError if LLM stream returns an error chunk', async () => {
    const filePath = 'src/error.py';
    const symbolName = 'errorFunc';
    const symbolCode = 'def errorFunc(): pass';

    mockBlock.params = { filePath, symbolName };
    extractSymbolCodeMock.mockResolvedValue(symbolCode);
    pathExtnameMock.mockReturnValue('.py');
    (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockStream([{ type: 'error', error: { message: 'LLM API error' } }])
    );

    await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

    expect(mockHandleError).toHaveBeenCalledWith(new Error('LLM call failed during test generation: LLM API error'));
    expect(mockPushToolResult).not.toHaveBeenCalled();
  });

  it('should call handleError if LLM stream throws an error', async () => {
    const filePath = 'src/streamError.js';
    const symbolName = 'streamErrorFunc';
    const symbolCode = 'function streamErrorFunc() {}';

    mockBlock.params = { filePath, symbolName };
    extractSymbolCodeMock.mockResolvedValue(symbolCode);
    pathExtnameMock.mockReturnValue('.js');
    (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // Simulate a stream that throws an error
      return (async function*() {
        yield { type: 'text', text: 'some partial text...' };
        throw new Error('Network connection lost');
      })();
    });

    await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

    expect(mockHandleError).toHaveBeenCalledWith(new Error('LLM call failed during test generation: Network connection lost'));
    expect(mockPushToolResult).not.toHaveBeenCalled();
  });

  it('should call handleError if LLM returns empty response', async () => {
    const filePath = 'src/empty.ts';
    const symbolName = 'EmptySym';
    const symbolCode = 'class EmptySym {}';

    mockBlock.params = { filePath, symbolName };
    extractSymbolCodeMock.mockResolvedValue(symbolCode);
    pathExtnameMock.mockReturnValue('.ts');
    (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mockReturnValue(
      createMockStream([{ type: 'text', text: '  ' }]) // Empty or whitespace only
    );

    await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

    expect(mockHandleError).toHaveBeenCalledWith(new Error('LLM returned empty response for test generation.'));
    expect(mockPushToolResult).not.toHaveBeenCalled();
  });

  describe('Prompt Construction', () => {
    const symbolCode = 'function example() {}';
    beforeEach(() => {
      extractSymbolCodeMock.mockResolvedValue(symbolCode);
      (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mockReturnValue(createMockStream([])); // Prevent actual call
    });

    it('should use correct language hint for TypeScript', async () => {
      mockBlock.params = { filePath: 'myFile.ts', symbolName: 'tsFunc' };
      pathExtnameMock.mockReturnValue('.ts');
      await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

      const createMessageArgs = (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      const systemPrompt = createMessageArgs[0];
      const userMessage = createMessageArgs[1][0].content;

      expect(systemPrompt).toContain('TypeScript/JavaScript code');
      expect(userMessage).toContain('TypeScript/JavaScript code');
    });

    it('should use correct language hint for Python', async () => {
      mockBlock.params = { filePath: 'myScript.py', symbolName: 'pyFunc' };
      pathExtnameMock.mockReturnValue('.py');
      await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

      const createMessageArgs = (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      const systemPrompt = createMessageArgs[0];
      const userMessage = createMessageArgs[1][0].content;

      expect(systemPrompt).toContain('PyTest style unit tests');
      expect(userMessage).toContain('PyTest style unit tests');
    });

    it('should use generic language hint for unknown extension', async () => {
      mockBlock.params = { filePath: 'myCode.unknown', symbolName: 'unknownFunc' };
      pathExtnameMock.mockReturnValue('.unknown');
      await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

      const createMessageArgs = (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      const systemPrompt = createMessageArgs[0];
      const userMessage = createMessageArgs[1][0].content;

      expect(systemPrompt).toContain('Generate unit tests for this code.');
      expect(userMessage).toContain('Generate unit tests for this code.');
    });

    it('should include filePath and symbolName in user message', async () => {
      const filePath = 'src/app.js';
      const symbolName = 'initialize';
      mockBlock.params = { filePath, symbolName };
      pathExtnameMock.mockReturnValue('.js');
      await generateTestsTool(mockCline, mockBlock, mockAskApproval, mockHandleError, mockPushToolResult);

      const createMessageArgs = (mockCline.api.createMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      const userMessage = createMessageArgs[1][0].content;

      expect(userMessage).toContain(`from the file "${filePath}"`);
      expect(userMessage).toContain(`symbol "${symbolName}"`);
      expect(userMessage).toContain(symbolCode);
    });
  });
});
