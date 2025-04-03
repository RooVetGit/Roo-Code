
var IN = class e {
	constructor(t, r, n, i) {
		this._apiServer = t
		this._pathHandler = r
		this._fileExtensions = n
		this._maxTrackedFiles = i
	}
	static verifyBatchSize = 1e3
	async describe(t, r, n) {
		let i = await this._getAllPathNames(t, r, n)
		if (i.length > this._maxTrackedFiles) return { trackable: !1 }
		let s = i.length,
			o = await this._chooseBlobNameSample(r, i)
		if (o.length === 0) return { trackable: !0, trackableFiles: 0, uploadedFraction: 1 }
		let a = await this._apiServer.findMissing(o),
			l = o.length,
			c = Math.min(a.unknownBlobNames.length, l)
		return { trackable: !0, trackableFiles: s, uploadedFraction: (l - c) / l }
	}
	async _getAllPathNames(t, r, n) {
		let i = await ZQ($_.Uri.file(t), $_.Uri.file(r), new QC(n), this._fileExtensions)
		return await bwe($_.Uri.file(t), $_.Uri.file(r), i, this._maxTrackedFiles + 1)
	}
	async _chooseBlobNameSample(t, r) {
		let n = new Array()
		for (; n.length < e.verifyBatchSize && r.length > 0; ) {
			let i = Math.floor(Math.random() * r.length),
				s = r[i]
			;(r[i] = r[r.length - 1]), r.pop()
			let o = $t(t, s),
				a = await this._pathHandler.readText(o)
			if (a.type !== "text") continue
			let l = this._pathHandler.calculateBlobName(s, a.contents)
			n.push(l)
		}
		return n
	}
}