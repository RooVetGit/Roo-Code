## Summary

This PR fixes issue #6720 where Roo Code incorrectly identifies the .roo folder location in multi-root workspaces. When .roo is added as one of the workspace folders, it should be recognized directly rather than being treated as a subdirectory of another workspace folder.

## Problem

In multi-root workspaces, when .roo is added as a workspace folder, Roo Code was still creating/looking for .roo as a subdirectory of the first workspace folder instead of recognizing the existing .roo workspace folder.

## Solution

- Added `findWorkspaceWithRoo()` utility function to detect when .roo is one of the workspace folders
- Updated `getProjectRooDirectoryForCwd()` to return the .roo workspace folder path directly when it exists
- Updated all direct .roo path constructions throughout the codebase to use the centralized utility functions
- Added comprehensive tests for multi-root workspace scenarios

## Changes

- **src/services/roo-config/index.ts**: Added `findWorkspaceWithRoo()` and updated `getProjectRooDirectoryForCwd()`
- **src/core/webview/webviewMessageHandler.ts**: Updated to use `getProjectRooDirectoryForCwd()`
- **src/services/mcp/McpHub.ts**: Updated to use `getProjectRooDirectoryForCwd()`
- **src/services/marketplace/SimpleInstaller.ts**: Updated to use `getProjectRooDirectoryForCwd()`
- **src/core/config/CustomModesManager.ts**: Updated to use `getProjectRooDirectoryForCwd()`
- **src/services/roo-config/**tests**/index.spec.ts**: Added tests for the new functionality

## Testing

- Added unit tests for `findWorkspaceWithRoo()` function
- Added tests for `getProjectRooDirectoryForCwd()` with multi-root workspace scenarios
- All existing tests pass without regression
- Manually tested in VS Code with multi-root workspaces

Fixes #6720
