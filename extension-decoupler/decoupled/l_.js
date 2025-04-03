
var QC = class {
		constructor(t = []) {
			this._ignoreSources = t
		}
		async build(t, r) {
			return await R8.buildNew(this._ignoreSources, t, r)
		}
	},
	L_ = class {
		constructor(t) {
			this.filename = t
		}
		getName(t) {
			return z1(P_.Uri.joinPath(t, this.filename))
		}
		async getRules(t, r) {
			if (!(r !== void 0 && !(r.find(([i, s]) => s === "File" && this.filename === i) !== void 0)))
				return Gyt(t, this.filename)
		}
	},
	KQ = class {
		constructor(t) {
			this._sourceFolderRootPath = t
		}
		getName() {
			return "default Augment rules"
		}
		getRules(t) {
			return new Promise((r) => {
				if (as(t) !== this._sourceFolderRootPath) r(void 0)
				else {
					let n = (0, k8.default)({ ignorecase: !1 })
					n.add([
						".git",
						"*.pem",
						"*.key",
						"*.pfx",
						"*.p12",
						"*.jks",
						"*.keystore",
						"*.pkcs12",
						"*.crt",
						"*.cer",
						"id_rsa",
						"id_ed25519",
						"id_ecdsa",
						"id_dsa",
						".augment-guidelines",
						".env",
					]),
						r(n)
				}
			})
		}
	}