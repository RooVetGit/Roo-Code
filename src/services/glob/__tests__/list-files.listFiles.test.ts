import { listFiles } from '../list-files';
import * as path from 'path';
import * as os from 'os';
import { globby } from 'globby';
import { arePathsEqual } from '../../../utils/path';

// Properly mock the path module
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn(),
  parse: jest.fn()
}));

// Properly mock the os module
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn()
}));

const mockPath = jest.mocked(path);
const mockOs = jest.mocked(os);

jest.mock('globby', () => ({
  __esModule: true,
  globby: jest.fn()
}));

const mockGlobby = globby as jest.MockedFunction<typeof globby>;

describe('listFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.resolve.mockImplementation((p) => p);
    mockPath.parse.mockImplementation((p) => ({
      root: p,
      dir: '',
      base: '',
      ext: '',
      name: ''
    }));
    mockOs.homedir.mockReturnValue('/home/user');
  });

  describe('special directories', () => {
    it('should return root directory when path is root', async () => {
      mockPath.resolve.mockReturnValue('/');
      const [files, isLimited] = await listFiles('/', false, 10);
      expect(files).toEqual(['/']);
      expect(isLimited).toBe(false);
    });

    it('should return home directory when path is home', async () => {
      const [files, isLimited] = await listFiles('/home/user', false, 10);
      expect(files).toEqual(['/home/user']);
      expect(isLimited).toBe(false);
    });
  });

  describe('file listing behavior', () => {
    it('should list files with recursion and limit', async () => {
      // First call returns root level files and dirs
      mockGlobby.mockResolvedValueOnce(['file1', 'dir1/', 'file2', 'dir2/']);
      // Subsequent calls for directory contents
      mockGlobby.mockResolvedValueOnce(['dir1/file3', 'dir1/subdir/']);
      mockGlobby.mockResolvedValueOnce(['dir2/file4']);
      
      const [files, isLimited] = await listFiles('/test', true, 3);
      expect(files).toEqual(['file1', 'dir1/', 'file2']);
      expect(isLimited).toBe(true);
    });

    it('should not ignore default directories when not recursive', async () => {
      // Reset any previous mock implementations
      mockGlobby.mockReset();
      // Mock specifically for the non-recursive case
      mockGlobby.mockResolvedValueOnce(['node_modules/file1', '__pycache__/file2']);
      const [files, isLimited] = await listFiles('/test', false, 10);
      expect(files).toEqual(['node_modules/file1', '__pycache__/file2']);
      expect(isLimited).toBe(false);
    });

    it('should handle limit correctly', async () => {
      // Reset any previous mock implementations
      mockGlobby.mockReset();
      const mockFiles = Array.from({ length: 12 }, (_, i) => `file${i + 1}`);
      // Mock specifically for the non-recursive case
      mockGlobby.mockResolvedValueOnce(mockFiles);
      
      const [files, isLimited] = await listFiles('/test', false, 10);
      expect(files.length).toBe(10);
      expect(isLimited).toBe(true);
      expect(files).toEqual(mockFiles.slice(0, 10));
    });
  });

  describe('error handling', () => {
    it('should throw error when globby fails', async () => {
      mockGlobby.mockImplementation(() => Promise.reject(new Error('Globby error')));
      await expect(listFiles('/test', true, 10)).rejects.toThrow('Globby error');
    });

    it('should handle timeout gracefully', async () => {
      // Mock a slow globby response that will trigger timeout
      mockGlobby.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(['file1']), 500)));
      
      const [files, isLimited] = await listFiles('/test', true, 10);
      expect(files.length).toBeLessThanOrEqual(10);
      expect(isLimited).toBe(false);
    }, 6000); // Increase test timeout to 6 seconds

    it('should handle directory markers correctly', async () => {
      mockGlobby.mockResolvedValueOnce(['dir1/', 'file1', 'dir2/']);
      mockGlobby.mockResolvedValueOnce(['dir1/file2']);
      mockGlobby.mockResolvedValueOnce(['dir2/file3']);

      const [files] = await listFiles('/test', true, 5);
      expect(files).toContain('dir1/');
      expect(files).toContain('dir2/');
      expect(files).toContain('file1');
    });
  });
});

describe('arePathsEqual', () => {
  it('should return true for identical paths', () => {
    expect(arePathsEqual('/test', '/test')).toBe(true);
  });

  it('should return false for different paths', () => {
    expect(arePathsEqual('/test', '/different')).toBe(false);
  });
});
