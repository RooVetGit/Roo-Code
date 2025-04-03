
var bC = class {
		constructor(t, r) {
			this.title = t
			this.action = r
			;(this.title = t), (this.action = r)
		}
	},
	Z1 = class extends z {
		constructor(r, n, i, s, o, a, l) {
			super()
			this._configListener = r
			this._suggestionManager = n
			this._keybindingWatcher = i
			this._globalState = s
			this._nextEditSessionEventReporter = o
			this._nextEditConfigManager = a
			this._completionVisibilityWatcher = l
			this._addInitialTutorial(), this._addSecondTutorial()
		}
		_addInitialTutorial() {
			let r = this._nextEditConfigManager.config.enableAutoApply,
				n = Vu(
					this._keybindingWatcher,
					this._configListener.config.nextEdit.enableGotoHinting ? Fa.commandID : Xo.commandID,
					!0,
				),
				i = Vu(this._keybindingWatcher, Uu.commandID, !0)
			this._addTutorial(
				"nextEditSuggestionSeen",
				(s) => s.newSuggestions,
				ui,
				"You have a Next Edit suggestion available. Next Edit helps you complete your train of thought by suggesting changes that continue your recent work.",
				[
					new bC(
						r ? `Preview & Apply (${n})` : `Preview (${n})`,
						j1(this._configListener.config.nextEdit.enableGotoHinting ? Fa.commandID : Xo.commandID),
					),
					new bC(`Dismiss All (${i})`, j1(Uu.commandID)),
				],
				"tutorial-initial-shown",
			)
		}
		_addSecondTutorial() {
			let r = Vu(this._keybindingWatcher, Co.commandID, !0),
				n = Vu(this._keybindingWatcher, "redo", !0),
				i = Vu(this._keybindingWatcher, qu.commandID, !0),
				s = [new bC("Learn More", j1(Yh.commandID))].concat(
					this._nextEditConfigManager.config.enablePanel
						? [new bC(`View All in Panel (${i})`, j1(qu.commandID))]
						: [],
				)
			this._addTutorial(
				"nextEditSuggestionAccepted",
				(o) => o.accepted,
				void 0,
				`You just applied a Next Edit suggestion! Use Undo (${r}) and Redo (${n}) to go back and forth between the original and suggested code.`,
				s,
				"tutorial-after-accept-shown",
			)
		}
		_addTutorial(r, n, i, s, o, a) {
			this._globalState.get(r) !== !0 &&
				this.addDisposable(
					this._suggestionManager.onSuggestionsChanged(async (l) => {
						if (
							!this._shouldShowTutorial(r, n(l), i) ||
							this._completionVisibilityWatcher.maybeInlineCompletionVisible
						)
							return
						this._globalState.update(r, !0),
							this._nextEditSessionEventReporter.reportEventWithoutIds(a, "unknown")
						let c = await X1.window.showInformationMessage(s, ...o)
						c?.action(),
							this._nextEditSessionEventReporter.reportEventWithoutIds(
								c ? "tutorial-nonempty-response" : "tutorial-empty-response",
								"unknown",
							)
					}),
				)
		}
		_shouldShowTutorial(r, n, i = void 0) {
			return i && (n = n.filter(i)), !(n.length === 0 || this._globalState.get(r) === !0)
		}
	}