
var a7 = W(require("crypto")),
	hE = 2023102300,
	fE = class extends Error {
		constructor(t) {
			super(`content exceeds maximum size of ${t}`)
		}
	},
	Hf = class {
		maxBlobSize
		_textEncoder = new TextEncoder()
		constructor(t) {
			this.maxBlobSize = t
		}
		_hash(t, r) {
			let n = a7.createHash("sha256")
			return n.update(t), n.update(r), n.digest("hex")
		}
		calculateOrThrow(t, r, n = !0) {
			if ((typeof r == "string" && (r = this._textEncoder.encode(r)), n && r.length > this.maxBlobSize))
				throw new fE(this.maxBlobSize)
			return this._hash(t, r)
		}
		calculate(t, r) {
			try {
				return this.calculateOrThrow(t, r, !0)
			} catch {
				return
			}
		}
		calculateNoThrow(t, r) {
			return this.calculateOrThrow(t, r, !1)
		}
	}