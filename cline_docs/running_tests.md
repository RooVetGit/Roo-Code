# Running Tests in Roo-Code

This document explains how to run tests in the Roo-Code codebase.

## Test Framework

The project uses Jest for testing, with both extension (backend) and webview (frontend) tests. The test configuration is defined in `jest.config.js` at the root of the project.

## Main Test Commands

- **Run all tests**:

    ```
    npm test
    ```

    This runs both extension and webview tests in parallel.

- **Run only extension tests**:

    ```
    npm run test:extension
    ```

- **Run only webview UI tests**:
    ```
    npm run test:webview
    ```

## Additional Options

- **Run specific test file**:

    ```
    npm run test:extension -- src/path/to/file.test.ts
    ```

- **Run tests with verbose output**:

    ```
    npm run test:extension -- --verbose
    ```

- **Update snapshots** (useful when system prompt changes):
    ```
    npm run test:extension -- -u
    ```
- **List all test files**:

    ```
    npm run test:extension -- --listTests
    ```

- **Troubleshoot hanging tests**:
    ```
    npm run test:extension -- --detectOpenHandles
    ```

## Test Structure

- Tests are located in `__tests__` directories throughout the codebase
- Test files use the `.test.ts` naming convention
- The project follows Jest conventions for test organization
- Snapshot tests are used for testing prompts and other text-based outputs
- Various mocks are implemented in `src/__mocks__/` directory

## Common Test Failures

### Snapshot Test Failures

Snapshot tests may fail when changes are made to the system prompt or other text-based outputs. For example, adding a new tool to the system prompt will cause snapshot tests to fail until they are updated.

To update snapshots:

```
npm run test:extension -- -u
```

Or update snapshots for a specific file:

```
npm run test:extension -- -u src/core/prompts/__tests__/system.test.ts
```

## Code Quality Rules

According to the `.clinerules` file, test coverage is important in this project:

1. Before attempting completion, always make sure that any code changes have test coverage
2. Ensure all tests pass before submitting changes
