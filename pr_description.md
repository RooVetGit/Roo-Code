Fixes #4647

## Problem

The .rooignore file was not properly excluding files in nested project folders. For example, when a user had:

```
Root Folder/
├── .rooignore (contains "example-nextjs/.next/")
└── example-nextjs/
    └── .next/ (should be ignored but wasn't)
```

The .next folder was still being indexed despite being listed in the .rooignore file.

## Root Cause

The DirectoryScanner was creating a new RooIgnoreController with the directory being scanned as the working directory, instead of using the workspace root. This meant the .rooignore file was being looked for in the wrong location.

## Solution

- Modified DirectoryScanner to accept an optional workspaceRoot parameter
- Updated the scanner to use the workspace root (instead of scan directory) for the RooIgnoreController
- Updated CodeIndexServiceFactory to pass the workspace path to the scanner
- Added fallback behavior for backward compatibility

## Changes

- src/services/code-index/processors/scanner.ts: Added workspaceRoot parameter and updated RooIgnoreController initialization
- src/services/code-index/service-factory.ts: Pass workspacePath to DirectoryScanner constructor
- src/services/code-index/processors/**tests**/scanner.spec.ts: Updated test to include new parameter

## Testing

- Existing tests continue to pass
- The fix ensures .rooignore files in the workspace root properly filter files in nested directories
- Backward compatibility maintained with fallback to scan directory if no workspace root provided
