# Handling ESLint `no-empty` Rule

Empty block statements (`{}`) are disallowed. All blocks MUST include a logging statement (e.g., `console.error`, `console.warn`, `console.log`, `console.debug`) to make their purpose explicit.

This applies to `if`, `else`, `while`, `for`, `switch` cases, `try...catch` blocks, and function bodies.

### Examples:

```javascript
// Correct: Logging in blocks
if (condition) {
	console.warn("Condition met, no specific action.")
}

try {
	criticalOperation()
} catch (error) {
	// For unexpected errors:
	console.error("Unexpected error in criticalOperation:", error)
}

function foo() {
	console.log("foo called, no operation.")
}
```

### Special Considerations:

- **Intentional Error Suppression**: Use `console.debug` in `catch` blocks if an error is intentionally suppressed.
    ```javascript
    try {
    	operationThatMightBenignlyFail()
    } catch (error) {
    	console.debug("Benign failure in operation, suppressed:", error)
    }
    ```
- **Constructors**: Empty constructors should log, preferably with `console.debug`.
- **Comments**: Comments can supplement logs but do not replace the logging requirement.
