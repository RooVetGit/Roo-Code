# Roo Code Development Guide

## Build & Test Commands

```bash
pnpm install         # Install dependencies
pnpm test            # Run all tests
pnpm lint            # Run ESLint
pnpm check-types     # TypeScript type checking
pnpm build           # Build the project
pnpm format          # Format code with Prettier

# Run a single test file (from src/ directory)
pnpm test path/to/test.spec.ts
```

## Code Style Guidelines

- **TypeScript**: Strict mode enabled, use explicit types
- **Testing**: Vitest with globals, no imports needed for `describe`, `test`, `it`
- **Linting**: ESLint with TypeScript rules, never disable without approval
- **Formatting**: Prettier for consistent code style
- **Imports**: Use relative paths, organize by external/internal/types
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Files**: kebab-case for filenames, `.test.ts` or `.spec.ts` for tests

## UI Development

- Use Tailwind CSS classes instead of inline styles
- VSCode CSS variables go in `webview-ui/src/index.css`
- Example: `<div className="text-vscode-descriptionForeground" />`

## Error Handling

- Use try-catch for async operations
- Log errors with context using the logger utility
- Provide meaningful error messages to users

## Testing Requirements

- All code changes must have test coverage
- Run tests from the directory containing package.json
- Tests use mocks in `src/__mocks__/` for VSCode APIs

## Monorepo Structure

This is a pnpm workspace monorepo using Turbo for build orchestration:

### Main Workspaces

- `/src` - Main VSCode extension code (package: roo-cline)
- `/webview-ui` - React-based UI components (@roo-code/vscode-webview)
- `/apps/` - Additional applications:
    - `vscode-e2e` - End-to-end tests using Mocha
    - `vscode-nightly` - Nightly build configuration
    - `web-docs` - Documentation website
    - `web-evals` - Evaluation system web app
    - `web-roo-code` - Main website
- `/packages/` - Shared packages:
    - `types` - Shared TypeScript types (@roo-code/types)
    - `cloud` - Cloud integration utilities
    - `telemetry` - Analytics and telemetry
    - `config-eslint` - Shared ESLint configuration
    - `config-typescript` - Shared TypeScript configuration
    - `ipc` - Inter-process communication utilities

### Key Dependencies

- Build: Turbo, pnpm workspaces
- Testing: Vitest (unit), Mocha (E2E)
- UI: React 18, Tailwind CSS, Radix UI
- Bundling: Vite (webview), esbuild (extension)
