# Handling `@typescript-eslint/no-unused-vars`

If `@typescript-eslint/no-unused-vars` flags an error, a declaration is unused.

## Guideline: Omit or Delete

Unused declarations MUST be omitted or deleted.

CRITICAL: Unused declarations MUST NOT be "fixed" by prefixing with an underscore (`_`). This is disallowed. Remove dead code, do not silence the linter.

### Examples:

#### Incorrect:

```typescript
// error: 'unusedVar' is defined but never used.
function example(usedParam: string, unusedParam: number): void {
	console.log(usedParam)
	// Incorrect fix:
	// const _unusedVar = 10;
}
```

```typescript
// error: 'error' is defined but never used.
try {
	// ...
} catch (error) {
	// 'error' is unused
	// Incorrect fix:
	// } catch (_error) {
	console.error("An operation failed.")
}
```

#### Correct:

```typescript
// 'unusedParam' removed if not needed by an interface/override.
function example(usedParam: string): void {
	// 'unusedParam' removed
	console.log(usedParam)
	// 'unusedVar' is completely removed.
}
```

```typescript
// 'error' variable is removed from the catch block if not used.
try {
	// ...
} catch {
	// 'error' variable omitted entirely
	console.error("An operation failed.")
}
```

### Rationale:

- Clarity: Removing unused code improves readability.
- Bugs: Unused variables can indicate errors.
- No Workarounds: Prefixing with `_` hides issues.

Code should be actively used.
