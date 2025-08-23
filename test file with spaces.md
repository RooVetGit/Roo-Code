# Test File with Spaces

This is a test file to reproduce the issue where files with spaces in their names don't appear in the @ autocomplete suggestions unless they are opened in VS Code first.

## Issue Details

- Files with spaces should appear in autocomplete
- Currently they only appear after being opened in a tab
- This is a regression from previous fixes

## Test Content

This file should be discoverable when typing `@test` in the Roo Code chat input.
