# 1. SUPPORTED LANGUAGES AND LOCATION

- Localize all strings into the following locale files: ca, de, en, es, fr, hi, it, ja, ko, nl, pl, pt-BR, ru, tr, vi, zh-CN, zh-TW
- The VSCode extension has two main areas that require localization:
    - Core Extension: src/i18n/locales/ (extension backend)
    - WebView UI: webview-ui/src/i18n/locales/ (user interface)

# 2. VOICE, STYLE AND TONE

- Always use informal speech (e.g., "du" instead of "Sie" in German) for all translations
- Maintain a direct and concise style that mirrors the tone of the original text
- Carefully account for colloquialisms and idiomatic expressions in both source and target languages
- Aim for culturally relevant and meaningful translations rather than literal translations
- Preserve the personality and voice of the original content
- Use natural-sounding language that feels native to speakers of the target language
- Don't translate the word "token" as it means something specific in English that all languages will understand
- Don't translate domain-specific words (especially technical terms like "Prompt") that are commonly used in English in the target language

# 3. CORE EXTENSION LOCALIZATION (src/)

- Located in src/i18n/locales/
- NOT ALL strings in core source need internationalization - only user-facing messages
- Internal error messages, debugging logs, and developer-facing messages should remain in English
- The t() function is used with namespaces like 'core:errors.missingToolParameter'
- Be careful when modifying interpolation variables; they must remain consistent across all translations
- Some strings in formatResponse.ts are intentionally not internationalized since they're internal
- When updating strings in core.json, maintain all existing interpolation variables
- Check string usages in the codebase before making changes to ensure you're not breaking functionality

# 4. WEBVIEW UI LOCALIZATION (webview-ui/src/)

- Located in webview-ui/src/i18n/locales/
- Uses standard React i18next patterns with the useTranslation hook
- All user interface strings should be internationalized
- Always use the Trans component with named components for text with embedded components

<Trans> example:

`"changeSettings": "You can always change this at the bottom of the <settingsLink>settings</settingsLink>",`

```
  <Trans
    i18nKey="welcome:telemetry.changeSettings"
    components={{
      settingsLink: <VSCodeLink href="#" onClick={handleOpenSettings} />
    }}
  />
```

# 5. TECHNICAL IMPLEMENTATION

- Use namespaces to organize translations logically
- Handle pluralization using i18next's built-in capabilities
- Implement proper interpolation for variables using {{variable}} syntax
- Don't include defaultValue. The `en` translations are the fallback
- Always use apply_diff instead of write_to_file when editing existing translation files (much faster and more reliable)
- When using apply_diff, carefully identify the exact JSON structure to edit to avoid syntax errors
- Placeholders (like {{variable}}) must remain exactly identical to the English source to maintain code integration and prevent syntax errors

# 6. WORKFLOW AND APPROACH

- First add or modify English strings, then ask for confirmation before translating to all other languages
- Use this process for each localization task:
    1. Identify where the string appears in the UI/codebase
    2. Understand the context and purpose of the string
    3. Update English translation first
    4. Create appropriate translations for all other supported languages
    5. Validate your changes with the missing translations script
- Flag or comment if an English source string is incomplete ("please see this...") to avoid truncated or unclear translations
- For UI elements, distinguish between:
    - Button labels: Use short imperative commands ("Save", "Cancel")
    - Tooltip text: Can be slightly more descriptive
- Preserve the original perspective: If text is a user command directed at the software, ensure the translation maintains this direction, avoiding language that makes it sound like an instruction from the system to the user

# 7. COMMON PITFALLS TO AVOID

- Switching between formal and informal addressing styles - always stay informal ("du" not "Sie")
- Translating or altering technical terms and brand names that should remain in English
- Modifying or removing placeholders like {{variable}} - these must remain identical
- Translating domain-specific terms that are commonly used in English in the target language
- Changing the meaning or nuance of instructions or error messages
- Forgetting to maintain consistent terminology throughout the translation

# 8. QUALITY ASSURANCE

- Maintain consistent terminology across all translations
- Respect the JSON structure of translation files
- Watch for placeholders and preserve them in translations
- Be mindful of text length in UI elements when translating to languages that might require more characters
- Use context-aware translations when the same string has different meanings
- Always validate your translation work by running the translation tests:
    ```
    npx jest --verbose locales/__tests__/lint-translations.test.ts locales/__tests__/find-missing-i18n-keys.test.ts
    ```
- Address any missing translations identified by the tests by using `node scripts/manage-translations.js` to ensure complete coverage across all locales:

```sh
./scripts/manage-translations.js
Usage:
Command Line Mode:
  Add/update translations:
    node scripts/manage-translations.js [-v] TRANSLATION_FILE KEY_PATH VALUE [KEY_PATH VALUE...]
  Delete translations:
    node scripts/manage-translations.js [-v] -d TRANSLATION_FILE1 [TRANSLATION_FILE2 ...] [ -- KEY1 ...]

Key Path Format:
  - Use single dot (.) for nested paths: 'command.newTask.title'
  - Use double dots (..) to include a literal dot in key names (like SMTP byte stuffing):
    'settings..path' -> { 'settings.path': 'value' }

  Examples:
    'command.newTask.title'     -> { command: { newTask: { title: 'value' } } }
    'settings..path'            -> { 'settings.path': 'value' }
    'nested.key..with..dots'    -> { nested: { 'key.with.dots': 'value' } }

Line-by-Line JSON Mode (--stdin):
  Each line must be a complete, single JSON object/array
  Multi-line or combined JSON is not supported

  Add/update translations:
    node scripts/manage-translations.js [-v] --stdin TRANSLATION_FILE
    Format: One object per line with exactly one key-value pair:
      {"command.newTask.title": "New Task"}
      {"settings..path": "Custom Path"}
      {"nested.key..with..dots": "Value with dots in key"}

  Delete translations:
    node scripts/manage-translations.js [-v] -d --stdin TRANSLATION_FILE
    Format: One array per line with exactly one key:
      ["command.newTask.title"]
      ["settings..path"]
      ["nested.key..with..dots"]

Options:
  -v        Enable verbose output (shows operations)
  -d        Delete mode - remove keys instead of setting them
  --stdin   Read line-by-line JSON from stdin

Examples:
  # Add via command line, it is recommended to execute multiple translations simultaneously.
  # The script expects a single file at a time with multiple key-value pairs, not multiple files.
  node scripts/manage-translations.js package.nls.json command.newTask.title "New Task" [ key2 translation2 ... ] && \
    node scripts/manage-translations.js package.nls.json settings..path "Custom Path" && \
    node scripts/manage-translations.js package.nls.json nested.key..with..dots "Value with dots"

  # Add multiple translations (one JSON object per line):
  translations.txt:
    {"command.newTask.title": "New Task"}
    {"settings..path": "Custom Path"}
    node scripts/manage-translations.js --stdin package.nls.json < translations.txt

  # Delete multiple keys (one JSON array per line):
  delete_keys.txt:
    ["command.newTask.title"]
    ["settings..path"]
    ["nested.key..with..dots"]
    node scripts/manage-translations.js -d --stdin package.nls.json < delete_keys.txt

  # Using here document for batching:
  node scripts/manage-translations.js --stdin package.nls.json << EOF
    {"command.newTask.title": "New Task"}
    {"settings..path": "Custom Path"}
  EOF

  # Delete using here document:
  node scripts/manage-translations.js -d --stdin package.nls.json << EOF
    ["command.newTask.title"]
    ["settings..path"]
    ["nested.key..with..dots"]
  EOF
```

# 9. TRANSLATOR'S CHECKLIST

- ✓ Used informal tone consistently ("du" not "Sie")
- ✓ Preserved all placeholders exactly as in the English source
- ✓ Maintained consistent terminology with existing translations
- ✓ Kept technical terms and brand names unchanged where appropriate
- ✓ Preserved the original perspective (user→system vs system→user)
- ✓ Adapted the text appropriately for UI context (buttons vs tooltips)
