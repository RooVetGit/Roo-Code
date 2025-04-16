# API Providers Extraction: Architecture & Migration Checklist

**Summary:**  
The goal of this migration is to extract all API provider logic from the main project into a standalone `api-providers` library. This makes the API layer easier to maintain, test, and reuse across projects. The process involves moving all provider code, updating imports, ensuring all dependencies are managed within the new package, and fully integrating the new library into the main project.

---

## Progress Update (April 15, 2025)

### What has been done:

- The new `api-providers` package was created and all provider code was moved into it.
- All internal imports in the new library and its test files are updated to use the new shared module path (`../../../shared` instead of `../../../shared/api`), reflecting the move of shared types/constants to an `index.ts` file.
- The following test files have had their imports updated to the new path:
    - `bedrock.test.ts`
    - `deepseek.test.ts`
    - `glama.test.ts`
    - `lmstudio.test.ts`
    - `mistral.test.ts`
    - `ollama.test.ts`
- Each file was updated to import from `../../../shared` (directory) rather than `../../../shared/api` (file).
- All test and source file imports from `../../../shared/api` to `../../../shared` are now complete.
- All required provider SDKs and dependencies have been added to `packages/api-providers/package.json`.
- The main program (including `src/core/Cline.ts` and `src/core/webview/ClineProvider.ts`) now uses the new `api-providers` package for all API logic. The import in `ClineProvider.ts` was updated from the old local API to the new package.
- The integration step is complete: all usage of the old API layer has been replaced with imports from the new package.
- Provider SDK dependencies have been removed from the main project's `package.json`.
- The build and type check process now completes successfully with the new library structure, after updating TypeScript module resolution and ensuring all dependencies are available at the root.

### What is next:

- [x] Remove provider SDK dependencies from the main project's `package.json` if no longer needed.
- [x] Re-run the build to confirm that the package and the main project compile successfully using the new library structure.
- [x] If the build passes, proceed to run all tests to ensure nothing is broken.
- [x] Once all tests pass, continue with the remaining checklist steps (dependency cleanup, documentation, etc.).

---

## How the API Provider System Works

[...unchanged, see previous version...]

---

## Checklist: Extract API Providers into a Standalone Library

Use this checklist to guide the process of moving the API provider layer into its own package/library.

---

### Preparation

- [x] Review the current API provider structure in `src/api/` and `src/api/providers/`
- [x] Identify all shared types/interfaces needed from `src/shared/api.ts`
- [x] List all provider-specific dependencies (SDKs, utilities)

---

### 1. Create the New Package

- [x] Create a new directory for the library (e.g., `packages/api-providers` or a new repo)
- [x] Initialize the package with `package.json`, `tsconfig.json`, etc.
- [x] Set up the directory structure (`src/`, `__tests__/`, etc.)

---

### 2. Move Code

- [x] Move all files from `src/api/` (including `providers/`, `transform/`, etc.) into the new package's `src/`
- [x] Move required shared types from `src/shared/api.ts` into the new package (or a shared package if needed)
- [x] Move provider-specific dependencies (from `src/utils/`, `src/shared/`, etc.) into the new package
- [x] Exclude non-essential extension/UI integration files (e.g., `human-relay.ts`, `ExtensionMessage.ts`, etc.) to keep the library minimal and maintainable

---

### 3. Update Imports

- [x] Update all internal imports in the new package to use relative paths (preserved by copying directory structure)
- [x] Remove or update imports in the API code that referenced excluded files (e.g., remove `HumanRelayHandler` from `index.ts`)
- [x] Update all test and source file imports from `../../../shared/api` to `../../../shared`

---

### 4. Manage Dependencies

- [x] Add all provider SDKs and dependencies to the new package's `package.json`
- [x] Remove these dependencies from the main project's `package.json` if no longer needed
- [x] Ensure all dependencies required by the library are available in the root node_modules for build tools

---

### 5. Testing

- [x] Ensure all provider tests run successfully in the new package
- [x] Mock or adapt any project-specific dependencies in tests
- [x] Run integration tests in the main project after switching to the new package

---

### 6. Build and Publish

- [x] Set up build scripts (e.g., using `tsc` or `esbuild`)
- [x] Build the package and verify output (package now compiles cleanly)
- [ ] Optionally publish the package to a registry (private or public)

---

### 7. Integrate with Main Project

- [x] Replace all usage of the old API layer in the main project with imports from the new package
- [x] Test the integration thoroughly to ensure everything works as expected
- [x] Ensure the new package is built automatically as part of the main project build process

---

### 8. Optional Improvements

- [ ] Expose only the public API (interfaces, factory, types) from the package entry point
- [ ] Add documentation and usage examples to the new package's README
- [ ] Consider open-sourcing the package if it is generic and reusable

---

### 9. Final Review

- [x] Confirm all references to the old API layer are removed from the main project
- [x] Ensure all tests (unit and integration) pass in both the library and the main project
- [x] Review for any remaining project-specific coupling and refactor as needed

---

**Notes:**

- Non-essential files (VSCode extension UI, integration, and human-relay logic) were excluded from the package to keep the library focused and maintainable.
- All core API provider logic and direct dependencies are included, preserving original file structure for easy syncing with the main fork.

**References:**

- Main API entry: `src/api/index.ts`
- Provider implementations: `src/api/providers/`
- Usage points: `src/core/Cline.ts`, `src/core/webview/ClineProvider.ts`
- Shared types: `src/shared/api.ts`
