# Handling ESLint `no-implicit-coercion` Errors

When ESLint's `no-implicit-coercion` rule flags an error, a value is being implicitly converted to a boolean, number, or string. While ESLint might suggest `Boolean(value)`, `Number(value)`, or `String(value)`, this project requires a different approach for boolean coercions.

## Guideline: Explicit, Context-Aware Comparisons

For boolean coercions (e.g., in `if` statements or ternaries), MUST NOT use `Boolean(value)`. Instead, extend conditional expressions to explicitly compare against the specific data type and value expected for that implementation context.

- Leverage TypeScript type information to make these explicit comparisons precise. For example:
    - Redundant checks for conditions already guaranteed by TypeScript type definitions (e.g., checking for `null` when a type is `SomeType | undefined`, or checking for `undefined` on a non-optional, initialized variable) MUST be omitted.
    - If a string type is a union of specific non-empty literals (e.g., `"active" | "pending"`), `typeof variable === "string"` can be sufficient for its "truthiness" if all literals are inherently truthy.
    - If types and initialization guarantee a variable is always defined and non-null (e.g., a non-optional class member), runtime checks for its mere existence can be redundant; the explicit boolean should reflect this guarantee.

YOU MUST NEVER replace `if (myVar)` with `if (Boolean(myVar))` or `if (!!myVar)` with `if (Boolean(myVar))`.

This rule's purpose is to encourage a thoughtful evaluation of what "truthy" or "falsy" means for the specific variable and logic.

### Examples:

## Incorrect (MUST NOT DO THIS):

```typescript
// Implicit coercion (flagged by ESLint)
if (someStringOrNull) {
	// ...
}

// Explicit coercion using Boolean() (not the preferred fix here)
if (Boolean(someStringOrNull)) {
	// ...
}
```

## Correct (Preferred Approach):

- Checking for a non-empty string:

    ```typescript
    if (typeof someStringOrNull === "string" && someStringOrNull != "") {
    	// ...
    }
    // Or, if an empty string is valid but null/undefined is not:
    if (typeof someStringOrNull === "string") {
    	// ...
    }
    ```

- Checking against `null` or `undefined`:

    ```typescript
    if (someValue !== null && someValue !== undefined) {
    	// ...
    }
    // Shorter (catches both null and undefined, mind other falsy values):
    if (someValue != null) {
    	// ...
    }
    ```

- Checking if a variable is assigned (not `undefined`):

    ```typescript
    if (someOptionalValue !== undefined) {
    	// ...
    }
    ```

- Checking if an array has elements:
    ```typescript
    if (Array.isArray(myArray) && myArray.length > 0) {
    	// ...
    }
    ```

### Rationale:

Explicitly comparing types and values:

1.  Clarifies the code's intent.
2.  Reduces ambiguity regarding how falsy values (`null`, `undefined`, `0`, `""`, `NaN`) are handled.
3.  Helps avoid bugs from overly general truthiness checks when specific conditions were needed.
4.  Be careful of regular expression evaluations. For example, `/foo (.*)bar/` will legitimately match an empty string, or it may not match at all. You MUST differentiate between `match === undefined` vs `typeof match === 'string' && match != ""` because falsy evaluation MUST NOT BE USED because it is usually invalid and certainly imprecise.
5.  Helps in distinguishing the original intent behind a `!!variable` check: was it for general "truthiness" or mere "existence (not undefined/null)"? This complements the type-aware checks mentioned in the Guideline.

Always consider the context: What does "truthy" or "falsy" mean for this variable in this logic? Write conditions reflecting that precise meaning.
