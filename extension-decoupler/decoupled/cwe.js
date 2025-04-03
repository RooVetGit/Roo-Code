
var Cwe = 6,
	vwe = 6,
	W_ = Cwe * vwe,
	uCt = 1e3,
	dCt = 2e3,
	fCt = 60 * 1e3,
	hCt = 200,
	gCt = 30 * 1e3,
	pCt = 30 * 1e3,
	ACt = 60 * 1e3,
	vN = class {
		constructor(t, r, n, i) {
			this.folderId = t
			this.pathName = r
			this.key = n
			this.appliedSeq = i
			;(this.recentChangesets = new Gc(vwe)), this.addChangeset(i), (this.changesSinceUpload = new OC())
		}
		uploadedBlobName
		uploadedSeq
		recentChangesets
		changesSinceUpload
		uploadRequested = !1
		inProgressUpload
		_embargoed = !1
		invalidateUploadState() {
			;(this.uploadedBlobName = void 0), (this.uploadedSeq = void 0)
		}
		_clear() {
			;(this.uploadedBlobName = void 0),
				(this.uploadedSeq = void 0),
				this.recentChangesets.clear(),
				(this.changesSinceUpload = void 0),
				(this.uploadRequested = !1),
				(this.inProgressUpload = void 0)
		}
		embargo() {
			this._clear(), (this._embargoed = !0)
		}
		get embargoed() {
			return this._embargoed
		}
		get uploadInProgress() {
			return this.inProgressUpload !== void 0
		}
		getBlobName() {
			return this.recentChanges(!1)?.blobName
		}
		longestHistory(t) {
			if (this.uploadedSeq === void 0) return
			let r = this.recentChangesets.at(0)
			if (r !== void 0) {
				if (t)
					return {
						changeTracker: r.changeTracker,
						blobName: this.uploadedBlobName,
					}
				if (this.uploadedBlobName !== void 0 && !(r.initialSeq > this.uploadedSeq))
					return {
						changeTracker: r.changeTracker,
						blobName: this.uploadedBlobName,
					}
			}
		}
		recentChanges(t) {
			return this.inProgressUpload !== void 0 ? this.inProgressUpload.savedChangeset : this.longestHistory(t)
		}
		applyAll(t, r, n, i) {
			for (let s of this.recentChangesets) s.changeTracker.apply(t, r, n, i)
			this.appliedSeq = t
		}
		advanceAll() {
			for (let t of this.recentChangesets) t.changeTracker.advance()
		}
		addChangeset(t) {
			this.recentChangesets.addItem({ initialSeq: t, changeTracker: new OC() })
		}
		purgeChangesets(t) {
			let r = 0
			for (
				;
				!this.recentChangesets.empty && !((this.recentChangesets.at(1)?.initialSeq ?? this.appliedSeq) >= t);

			)
				this.recentChangesets.shiftLeft(1), r++
			return r
		}
	},
	g6 = class extends vN {
		constructor(r, n, i, s, o) {
			super(r, n, i, o)
			this.document = s
		}
		get documentType() {
			return 0
		}
		getText() {
			return this.document.getText()
		}
	},
	p6 = class extends vN {
		constructor(r, n, i, s, o) {
			super(r, n, i, o)
			this.document = s
		}
		get documentType() {
			return 1
		}
		getText() {
			return _G(this.document)
		}
	}