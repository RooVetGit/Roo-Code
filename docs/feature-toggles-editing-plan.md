# Roo Code Editing Behavior Feature Toggles – Implementation Plan

## Overview

Introduce granular feature toggles for all editing behaviors in Roo Code, allowing users to control the observability and workflow of file edits. Add a new file-system-based editing mode, and ensure mutual exclusivity between file-based and diff-based editing.

---

## 1. Settings Structure & UI Integration

- Add new toggles to the settings context and UI:
    - **File-system-based editing** (exclusive mode)
    - **Open files without stealing focus**
    - **Open tabs in correct tab group**
    - **Open tabs at end of tab list**
- Group these under a new "File Editing" section in the settings UI.
- Surface all toggles in both the settings UI and the command palette.

---

## 2. Mutual Exclusivity Logic

- Enabling file-system-based editing will:
    - Automatically disable all other editing-related toggles (tab closing, tab group, tab order, etc.) in both UI and logic.
    - Bypass all tab management logic.
- Only one of file-system-based editing or diff view can be active at a time.

---

## 3. Implementation Steps

```mermaid
flowchart TD
    A[Add new toggles to ExtensionStateContext] --> B[Add toggles to settings UI ("File Editing" section)]
    B --> C[Update UI and command palette to surface toggles and enforce exclusivity]
    C --> D[Update DiffViewProvider and related logic to respect toggles]
    D --> E[Implement file-system-based editing logic]
    E --> F[Document each toggle and its impact]
```

---

## 4. Editor Logic

- Update `DiffViewProvider` and related files to:
    - Respect the new toggles.
    - Enforce that file-system-based editing disables all tab-related features.
    - Ensure only one editing mode is active at a time.

---

## 5. Testing & Documentation

- **You will write the tests yourself.**
- Document each toggle and its impact in both user and developer documentation.

---

## Summary

This plan ensures clarity, user control, and a seamless experience for both file-based and diff-based editing workflows in Roo Code.
