---
"@roo-code/types": patch
"roo-cline": patch
---

This branch implements a new feature called "parentRulesMaxDepth" which controls how many parent directories are searched for `.roo/rules` files. The setting is accessible from the Modes view and persists across sessions.

1. **Added Configuration Schema**

    - Added `parentRulesMaxDepth` to the global settings schema in `packages/types/src/global-settings.ts`

2. **Enhanced Rules Loading Logic**

    - Modified `getRooDirectoriesForCwd()` in `src/services/roo-config/index.ts` to search parent directories based on the configured depth
    - Replaced array with Set to avoid duplicates and added proper sorting

3. **Added UI Components**

    - Added a numeric input field in the Modes view to control the setting
    - Added localization strings for the new setting

4. **State Management**
    - Updated extension state context to store and manage the setting
    - Added message handlers to process setting changes

This feature allows for hierarchical loading of rules from parent directories, enabling more flexible configuration management across different levels (workspace, repository, organization, user-global).
