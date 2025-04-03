
	var ET = function (e, t, r) {
			var n = {}
			if (e !== xr["RSASSA-PSS"]) return n
			r &&
				(n = {
					hash: { algorithmOid: xr.sha1 },
					mgf: { algorithmOid: xr.mgf1, hash: { algorithmOid: xr.sha1 } },
					saltLength: 20,
				})
			var i = {},
				s = []
			if (!D.validate(t, iXe, i, s)) {
				var o = new Error("Cannot read RSASSA-PSS parameter block.")
				throw ((o.errors = s), o)
			}
			return (
				i.hashOid !== void 0 && ((n.hash = n.hash || {}), (n.hash.algorithmOid = D.derToOid(i.hashOid))),
				i.maskGenOid !== void 0 &&
					((n.mgf = n.mgf || {}),
					(n.mgf.algorithmOid = D.derToOid(i.maskGenOid)),
					(n.mgf.hash = n.mgf.hash || {}),
					(n.mgf.hash.algorithmOid = D.derToOid(i.maskGenHashOid))),
				i.saltLength !== void 0 && (n.saltLength = i.saltLength.charCodeAt(0)),
				n
			)
		},
		bT = function (e) {
			switch (xr[e.signatureOid]) {
				case "sha1WithRSAEncryption":
				case "sha1WithRSASignature":
					return nt.md.sha1.create()
				case "md5WithRSAEncryption":
					return nt.md.md5.create()
				case "sha256WithRSAEncryption":
					return nt.md.sha256.create()
				case "sha384WithRSAEncryption":
					return nt.md.sha384.create()
				case "sha512WithRSAEncryption":
					return nt.md.sha512.create()
				case "RSASSA-PSS":
					return nt.md.sha256.create()
				default:
					var t = new Error("Could not compute " + e.type + " digest. Unknown signature OID.")
					throw ((t.signatureOid = e.signatureOid), t)
			}
		},
		fce = function (e) {
			var t = e.certificate,
				r
			switch (t.signatureOid) {
				case xr.sha1WithRSAEncryption:
				case xr.sha1WithRSASignature:
					break
				case xr["RSASSA-PSS"]:
					var n, i
					if (((n = xr[t.signatureParameters.mgf.hash.algorithmOid]), n === void 0 || nt.md[n] === void 0)) {
						var s = new Error("Unsupported MGF hash function.")
						throw ((s.oid = t.signatureParameters.mgf.hash.algorithmOid), (s.name = n), s)
					}
					if (((i = xr[t.signatureParameters.mgf.algorithmOid]), i === void 0 || nt.mgf[i] === void 0)) {
						var s = new Error("Unsupported MGF function.")
						throw ((s.oid = t.signatureParameters.mgf.algorithmOid), (s.name = i), s)
					}
					if (
						((i = nt.mgf[i].create(nt.md[n].create())),
						(n = xr[t.signatureParameters.hash.algorithmOid]),
						n === void 0 || nt.md[n] === void 0)
					) {
						var s = new Error("Unsupported RSASSA-PSS hash function.")
						throw ((s.oid = t.signatureParameters.hash.algorithmOid), (s.name = n), s)
					}
					r = nt.pss.create(nt.md[n].create(), i, t.signatureParameters.saltLength)
					break
			}
			return t.publicKey.verify(e.md.digest().getBytes(), e.signature, r)
		}