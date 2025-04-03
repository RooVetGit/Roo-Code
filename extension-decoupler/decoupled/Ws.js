
var ws = ((re) => (
		(re.Unknown = "unknown"),
		(re.Command = "command"),
		(re.Background = "background"),
		(re.Global = "global"),
		(re.Click = "click"),
		(re.RightClick = "right-click"),
		(re.HoverClick = "hover-click"),
		(re.EditorActionClick = "editor-action-click"),
		(re.Keybinding = "keybinding"),
		(re.Keyboard = "keyboard"),
		(re.ActiveEditorChanged = "active-editor-changed"),
		(re.EditorSelectionChanged = "editor-selection-changed"),
		(re.EditorVisibleRangesChanged = "editor-visible-ranges-changed"),
		(re.HoveredOutsideSuggestion = "hovered-outside-suggestion"),
		(re.DocumentChanged = "document-changed"),
		(re.NextEditPanelItemFocusClick = "next-edit-panel-item-focus-click"),
		(re.NextEditPanelItemClick = "next-edit-panel-item-click"),
		(re.CodeAction = "code-action"),
		(re.GutterClick = "gutter-click"),
		(re.CodeLens = "code-lens"),
		(re.Tutorial = "tutorial"),
		(re.Error = "error"),
		(re.ValidationExpected = "validation-expected"),
		(re.ValidationUnexpected = "validation-unexpected"),
		(re.DebugSession = "debug-session"),
		(re.NotebookDocument = "notebook-document"),
		(re.UnsupportedUri = "unsupported-uri"),
		(re.MissingPathName = "missing-path-name"),
		(re.NotActiveEditor = "not-active-editor"),
		(re.NoContentChanges = "no-content-changes"),
		(re.FreshSuggestions = "fresh-suggestions"),
		re
	))(ws || {}),
	eW = class {
		constructor(t, r, n, i, s) {
			this.path = t
			this.range = r
			this.charStart = n
			this.charStop = i
			this.header = s
		}
	},
	ZR = class extends eW {
		constructor(t, r, n, i, s) {
			super(t, r, n, i, s)
		}
	}