
var I1 = class extends z {
	_logger = X("SuppressDeletedCompletions")
	_inProgressDeletion = void 0
	_prevCompletions = void 0
	constructor() {
		super(),
			this.addDisposables(
				CA.workspace.onDidChangeTextDocument((t) => {
					this._onTextDocumentChange(t)
				}),
				CA.window.onDidChangeActiveTextEditor((t) => {
					this._resetDeletions(t)
				}),
			)
	}
	_onTextDocumentChange(t) {
		if ((t.document.uri.scheme !== "file" && !yo(t.document.uri)) || t.contentChanges.length === 0) return
		if (
			this._inProgressDeletion === void 0 ||
			t.contentChanges.length !== 1 ||
			t.contentChanges[0].text.length > 0 ||
			t.document !== this._inProgressDeletion.document
		) {
			;(this._inProgressDeletion = {
				document: t.document,
				preDeletionDocumentText: t.document.getText(),
				prevDeletionRange: void 0,
				prevDeletionText: void 0,
				curDocumentText: t.document.getText(),
			}),
				(this._prevCompletions = [])
			return
		}
		;(this._inProgressDeletion.prevDeletionRange === void 0 ||
			!this._areAdjacentDeletions(t.contentChanges[0].range, this._inProgressDeletion.prevDeletionRange)) &&
			(this._inProgressDeletion.preDeletionDocumentText = this._inProgressDeletion.curDocumentText)
		let r = this._inProgressDeletion.curDocumentText.substring(
			t.contentChanges[0].rangeOffset,
			t.contentChanges[0].rangeOffset + t.contentChanges[0].rangeLength,
		)
		;(this._inProgressDeletion.prevDeletionRange = t.contentChanges[0].range),
			(this._inProgressDeletion.prevDeletionText = r),
			(this._inProgressDeletion.curDocumentText = t.document.getText())
	}
	_areAdjacentDeletions(t, r) {
		return t.end.isEqual(r.start) || t.start.isEqual(r.start)
	}
	_resetDeletions(t) {
		if (((this._prevCompletions = []), t === void 0)) {
			this._inProgressDeletion = void 0
			return
		}
		this._inProgressDeletion = {
			document: t.document,
			preDeletionDocumentText: t.document.getText(),
			prevDeletionRange: void 0,
			prevDeletionText: void 0,
			curDocumentText: t.document.getText(),
		}
	}
	processRequest(t) {
		if (!t || !this._inProgressDeletion) return t
		let r = t.completions
		return (
			this._inProgressDeletion.document === t.document &&
				(r = t.completions.filter((n) =>
					this._checkIfCompletionWasDeleted(t, n)
						? (this._logger.debug("Suppressing previously deleted completion"), !1)
						: this._checkIfForwardDeletion(t, n)
							? (this._logger.debug("Suppressing completion due to forward deletion"), !1)
							: !0,
				)),
			this._inProgressDeletion.document === t.document && (this._prevCompletions = [...t.completions]),
			(t.completions = r),
			t
		)
	}
	_checkIfCompletionWasDeleted(t, r) {
		let n = t.document,
			i = n.getText(new CA.Range(n.positionAt(0), n.positionAt(r.range.startOffset))),
			s = n.getText(
				new CA.Range(
					n.positionAt(r.range.endOffset + r.skippedSuffix.length),
					n.positionAt(n.getText().length),
				),
			),
			o = i + r.completionText + s
		return this._inProgressDeletion.preDeletionDocumentText === o
	}
	_checkIfForwardDeletion(t, r) {
		if (this._inProgressDeletion.prevDeletionRange)
			return this._prevCompletions?.some((i) => {
				let s = this._inProgressDeletion?.document?.positionAt(i.range.endOffset),
					o = t.document.positionAt(r.range.endOffset)
				if (!s || !s.isEqual(o)) return !1
				let a = (i.completionText + i.suffixReplacementText).substring(i.range.endOffset - i.range.startOffset),
					l = r.completionText + r.suffixReplacementText,
					c = [a]
				if (
					(this._inProgressDeletion?.prevDeletionText &&
						c.push(a + this._inProgressDeletion?.prevDeletionText),
					!c.some((f) => f === l))
				)
					return !1
				let u = this._inProgressDeletion?.document.positionAt(i.range.endOffset)
				return (
					u &&
					this._inProgressDeletion?.prevDeletionRange?.start &&
					u.isEqual(this._inProgressDeletion.prevDeletionRange.start)
				)
			})
	}
}