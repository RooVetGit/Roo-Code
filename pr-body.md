<!--
Thank you for contributing to Roo Code!

Before submitting your PR, please ensure:
- It's linked to an approved GitHub Issue.
- You've reviewed our [Contributing Guidelines](../CONTRIBUTING.md).
-->

### Related GitHub Issue

Closes: #3186

### Roo Code Task Context (Optional)

_No Roo Code task context for this PR_

### Description

This PR implements comprehensive accessibility improvements for the @ context menu to make it fully accessible to screen readers. The issue reported that when users type '@' to trigger the file insertion context menu, the menu appears visually but is not announced by screen readers, making it inaccessible to users with visual impairments.

**Key implementation details:**
- Added proper ARIA roles (role="listbox" for menu, role="option" for items)
- Implemented ARIA states (aria-expanded, aria-selected, aria-activedescendant)
- Added live region for real-time announcements to screen readers
- Enhanced keyboard navigation with proper focus management
- Added descriptive labels and instructions for screen reader users

**Design choices:**
- Used aria-live="polite" to avoid interrupting screen reader flow
- Positioned live region off-screen using standard screen reader techniques
- Maintained existing visual design while adding semantic accessibility
- Ensured announcements are contextual and informative

### Test Procedure

**Manual testing with screen readers:**
1. Open VSCode with a screen reader (VoiceOver, NVDA, or JAWS)
2. Focus on the chat input field
3. Type '@' to trigger the context menu
4. Verify screen reader announces: "File insertion menu opened"
5. Use arrow keys to navigate menu items
6. Verify each item is announced with position info (e.g., "File: example.txt, 1 of 5")
7. Press Escape to close menu
8. Verify screen reader announces: "File insertion menu closed"

**Keyboard navigation testing:**
- Arrow keys should navigate through selectable options
- Enter/Tab should select the highlighted option
- Escape should close the menu and return focus to textarea
- Menu should maintain proper focus management

### Pre-Submission Checklist

- [x] **Issue Linked**: This PR is linked to an approved GitHub Issue (see "Related GitHub Issue" above).
- [x] **Scope**: My changes are focused on the linked issue (one major feature/fix per PR).
- [x] **Self-Review**: I have performed a thorough self-review of my code.
- [x] **Testing**: New and/or updated tests have been added to cover my changes (if applicable).
- [x] **Documentation Impact**: I have considered if my changes require documentation updates (see "Documentation Updates" section below).
- [x] **Contribution Guidelines**: I have read and agree to the [Contributor Guidelines](/CONTRIBUTING.md).

### Screenshots / Videos

_No UI changes in this PR - accessibility improvements are semantic and announced by screen readers_

### Documentation Updates

- [x] No documentation updates are required.

### Additional Notes

**Accessibility standards compliance:**
- Follows WCAG 2.1 AA guidelines for keyboard navigation and screen reader support
- Implements WAI-ARIA best practices for listbox pattern
- Uses semantic HTML and ARIA attributes appropriately

**Technical considerations:**
- Changes are backward compatible and don't affect existing functionality
- Live region announcements are non-intrusive and contextual
- Implementation follows existing code patterns and conventions

### Get in Touch

@roomote-agent