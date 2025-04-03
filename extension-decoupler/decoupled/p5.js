
var P5 = x((cBt, Ace) => {
	"use strict"
	var gn = Yt()
	gc()
	O0()
	dh()
	M5()
	k5()
	cl()
	Rb()
	W0()
	Sr()
	xT()
	var V = gn.asn1,
		or = gn.pki,
		Mb = (Ace.exports = gn.pkcs12 = gn.pkcs12 || {}),
		pce = {
			name: "ContentInfo",
			tagClass: V.Class.UNIVERSAL,
			type: V.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "ContentInfo.contentType",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.OID,
					constructed: !1,
					capture: "contentType",
				},
				{
					name: "ContentInfo.content",
					tagClass: V.Class.CONTEXT_SPECIFIC,
					constructed: !0,
					captureAsn1: "content",
				},
			],
		},
		uXe = {
			name: "PFX",
			tagClass: V.Class.UNIVERSAL,
			type: V.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "PFX.version",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.INTEGER,
					constructed: !1,
					capture: "version",
				},
				pce,
				{
					name: "PFX.macData",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.SEQUENCE,
					constructed: !0,
					optional: !0,
					captureAsn1: "mac",
					value: [
						{
							name: "PFX.macData.mac",
							tagClass: V.Class.UNIVERSAL,
							type: V.Type.SEQUENCE,
							constructed: !0,
							value: [
								{
									name: "PFX.macData.mac.digestAlgorithm",
									tagClass: V.Class.UNIVERSAL,
									type: V.Type.SEQUENCE,
									constructed: !0,
									value: [
										{
											name: "PFX.macData.mac.digestAlgorithm.algorithm",
											tagClass: V.Class.UNIVERSAL,
											type: V.Type.OID,
											constructed: !1,
											capture: "macAlgorithm",
										},
										{
											name: "PFX.macData.mac.digestAlgorithm.parameters",
											tagClass: V.Class.UNIVERSAL,
											captureAsn1: "macAlgorithmParameters",
										},
									],
								},
								{
									name: "PFX.macData.mac.digest",
									tagClass: V.Class.UNIVERSAL,
									type: V.Type.OCTETSTRING,
									constructed: !1,
									capture: "macDigest",
								},
							],
						},
						{
							name: "PFX.macData.macSalt",
							tagClass: V.Class.UNIVERSAL,
							type: V.Type.OCTETSTRING,
							constructed: !1,
							capture: "macSalt",
						},
						{
							name: "PFX.macData.iterations",
							tagClass: V.Class.UNIVERSAL,
							type: V.Type.INTEGER,
							constructed: !1,
							optional: !0,
							capture: "macIterations",
						},
					],
				},
			],
		},
		dXe = {
			name: "SafeBag",
			tagClass: V.Class.UNIVERSAL,
			type: V.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "SafeBag.bagId",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.OID,
					constructed: !1,
					capture: "bagId",
				},
				{
					name: "SafeBag.bagValue",
					tagClass: V.Class.CONTEXT_SPECIFIC,
					constructed: !0,
					captureAsn1: "bagValue",
				},
				{
					name: "SafeBag.bagAttributes",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.SET,
					constructed: !0,
					optional: !0,
					capture: "bagAttributes",
				},
			],
		},
		fXe = {
			name: "Attribute",
			tagClass: V.Class.UNIVERSAL,
			type: V.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "Attribute.attrId",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.OID,
					constructed: !1,
					capture: "oid",
				},
				{
					name: "Attribute.attrValues",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.SET,
					constructed: !0,
					capture: "values",
				},
			],
		},
		hXe = {
			name: "CertBag",
			tagClass: V.Class.UNIVERSAL,
			type: V.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "CertBag.certId",
					tagClass: V.Class.UNIVERSAL,
					type: V.Type.OID,
					constructed: !1,
					capture: "certId",
				},
				{
					name: "CertBag.certValue",
					tagClass: V.Class.CONTEXT_SPECIFIC,
					constructed: !0,
					value: [
						{
							name: "CertBag.certValue[0]",
							tagClass: V.Class.UNIVERSAL,
							type: V.Class.OCTETSTRING,
							constructed: !1,
							capture: "cert",
						},
					],
				},
			],
		}
	function kb(e, t, r, n) {
		for (var i = [], s = 0; s < e.length; s++)
			for (var o = 0; o < e[s].safeBags.length; o++) {
				var a = e[s].safeBags[o]
				if (!(n !== void 0 && a.type !== n)) {
					if (t === null) {
						i.push(a)
						continue
					}
					a.attributes[t] !== void 0 && a.attributes[t].indexOf(r) >= 0 && i.push(a)
				}
			}
		return i
	}
	Mb.pkcs12FromAsn1 = function (e, t, r) {
		typeof t == "string" ? ((r = t), (t = !0)) : t === void 0 && (t = !0)
		var n = {},
			i = []
		if (!V.validate(e, uXe, n, i)) {
			var s = new Error("Cannot read PKCS#12 PFX. ASN.1 object is not an PKCS#12 PFX.")
			throw ((s.errors = s), s)
		}
		var o = {
			version: n.version.charCodeAt(0),
			safeContents: [],
			getBags: function (C) {
				var v = {},
					b
				return (
					"localKeyId" in C
						? (b = C.localKeyId)
						: "localKeyIdHex" in C && (b = gn.util.hexToBytes(C.localKeyIdHex)),
					b === void 0 &&
						!("friendlyName" in C) &&
						"bagType" in C &&
						(v[C.bagType] = kb(o.safeContents, null, null, C.bagType)),
					b !== void 0 && (v.localKeyId = kb(o.safeContents, "localKeyId", b, C.bagType)),
					"friendlyName" in C &&
						(v.friendlyName = kb(o.safeContents, "friendlyName", C.friendlyName, C.bagType)),
					v
				)
			},
			getBagsByFriendlyName: function (C, v) {
				return kb(o.safeContents, "friendlyName", C, v)
			},
			getBagsByLocalKeyId: function (C, v) {
				return kb(o.safeContents, "localKeyId", C, v)
			},
		}
		if (n.version.charCodeAt(0) !== 3) {
			var s = new Error("PKCS#12 PFX of version other than 3 not supported.")
			throw ((s.version = n.version.charCodeAt(0)), s)
		}
		if (V.derToOid(n.contentType) !== or.oids.data) {
			var s = new Error("Only PKCS#12 PFX in password integrity mode supported.")
			throw ((s.oid = V.derToOid(n.contentType)), s)
		}
		var a = n.content.value[0]
		if (a.tagClass !== V.Class.UNIVERSAL || a.type !== V.Type.OCTETSTRING)
			throw new Error("PKCS#12 authSafe content data is not an OCTET STRING.")
		if (((a = N5(a)), n.mac)) {
			var l = null,
				c = 0,
				u = V.derToOid(n.macAlgorithm)
			switch (u) {
				case or.oids.sha1:
					;(l = gn.md.sha1.create()), (c = 20)
					break
				case or.oids.sha256:
					;(l = gn.md.sha256.create()), (c = 32)
					break
				case or.oids.sha384:
					;(l = gn.md.sha384.create()), (c = 48)
					break
				case or.oids.sha512:
					;(l = gn.md.sha512.create()), (c = 64)
					break
				case or.oids.md5:
					;(l = gn.md.md5.create()), (c = 16)
					break
			}
			if (l === null) throw new Error("PKCS#12 uses unsupported MAC algorithm: " + u)
			var f = new gn.util.ByteBuffer(n.macSalt),
				p = "macIterations" in n ? parseInt(gn.util.bytesToHex(n.macIterations), 16) : 1,
				g = Mb.generateKey(r, f, 3, p, c, l),
				m = gn.hmac.create()
			m.start(l, g), m.update(a.value)
			var y = m.getMac()
			if (y.getBytes() !== n.macDigest) throw new Error("PKCS#12 MAC could not be verified. Invalid password?")
		}
		return gXe(o, a.value, t, r), o
	}
	function N5(e) {
		if (e.composed || e.constructed) {
			for (var t = gn.util.createBuffer(), r = 0; r < e.value.length; ++r) t.putBytes(e.value[r].value)
			;(e.composed = e.constructed = !1), (e.value = t.getBytes())
		}
		return e
	}
	function gXe(e, t, r, n) {
		if (
			((t = V.fromDer(t, r)),
			t.tagClass !== V.Class.UNIVERSAL || t.type !== V.Type.SEQUENCE || t.constructed !== !0)
		)
			throw new Error("PKCS#12 AuthenticatedSafe expected to be a SEQUENCE OF ContentInfo")
		for (var i = 0; i < t.value.length; i++) {
			var s = t.value[i],
				o = {},
				a = []
			if (!V.validate(s, pce, o, a)) {
				var l = new Error("Cannot read ContentInfo.")
				throw ((l.errors = a), l)
			}
			var c = { encrypted: !1 },
				u = null,
				f = o.content.value[0]
			switch (V.derToOid(o.contentType)) {
				case or.oids.data:
					if (f.tagClass !== V.Class.UNIVERSAL || f.type !== V.Type.OCTETSTRING)
						throw new Error("PKCS#12 SafeContents Data is not an OCTET STRING.")
					u = N5(f).value
					break
				case or.oids.encryptedData:
					;(u = pXe(f, n)), (c.encrypted = !0)
					break
				default:
					var l = new Error("Unsupported PKCS#12 contentType.")
					throw ((l.contentType = V.derToOid(o.contentType)), l)
			}
			;(c.safeBags = AXe(u, r, n)), e.safeContents.push(c)
		}
	}
	function pXe(e, t) {
		var r = {},
			n = []
		if (!V.validate(e, gn.pkcs7.asn1.encryptedDataValidator, r, n)) {
			var i = new Error("Cannot read EncryptedContentInfo.")
			throw ((i.errors = n), i)
		}
		var s = V.derToOid(r.contentType)
		if (s !== or.oids.data) {
			var i = new Error("PKCS#12 EncryptedContentInfo ContentType is not Data.")
			throw ((i.oid = s), i)
		}
		s = V.derToOid(r.encAlgorithm)
		var o = or.pbe.getCipher(s, r.encParameter, t),
			a = N5(r.encryptedContentAsn1),
			l = gn.util.createBuffer(a.value)
		if ((o.update(l), !o.finish())) throw new Error("Failed to decrypt PKCS#12 SafeContents.")
		return o.output.getBytes()
	}
	function AXe(e, t, r) {
		if (!t && e.length === 0) return []
		if (
			((e = V.fromDer(e, t)),
			e.tagClass !== V.Class.UNIVERSAL || e.type !== V.Type.SEQUENCE || e.constructed !== !0)
		)
			throw new Error("PKCS#12 SafeContents expected to be a SEQUENCE OF SafeBag.")
		for (var n = [], i = 0; i < e.value.length; i++) {
			var s = e.value[i],
				o = {},
				a = []
			if (!V.validate(s, dXe, o, a)) {
				var l = new Error("Cannot read SafeBag.")
				throw ((l.errors = a), l)
			}
			var c = { type: V.derToOid(o.bagId), attributes: mXe(o.bagAttributes) }
			n.push(c)
			var u,
				f,
				p = o.bagValue.value[0]
			switch (c.type) {
				case or.oids.pkcs8ShroudedKeyBag:
					if (((p = or.decryptPrivateKeyInfo(p, r)), p === null))
						throw new Error("Unable to decrypt PKCS#8 ShroudedKeyBag, wrong password?")
				case or.oids.keyBag:
					try {
						c.key = or.privateKeyFromAsn1(p)
					} catch {
						;(c.key = null), (c.asn1 = p)
					}
					continue
				case or.oids.certBag:
					;(u = hXe),
						(f = function () {
							if (V.derToOid(o.certId) !== or.oids.x509Certificate) {
								var m = new Error("Unsupported certificate type, only X.509 supported.")
								throw ((m.oid = V.derToOid(o.certId)), m)
							}
							var y = V.fromDer(o.cert, t)
							try {
								c.cert = or.certificateFromAsn1(y, !0)
							} catch {
								;(c.cert = null), (c.asn1 = y)
							}
						})
					break
				default:
					var l = new Error("Unsupported PKCS#12 SafeBag type.")
					throw ((l.oid = c.type), l)
			}
			if (u !== void 0 && !V.validate(p, u, o, a)) {
				var l = new Error("Cannot read PKCS#12 " + u.name)
				throw ((l.errors = a), l)
			}
			f()
		}
		return n
	}
	function mXe(e) {
		var t = {}
		if (e !== void 0)
			for (var r = 0; r < e.length; ++r) {
				var n = {},
					i = []
				if (!V.validate(e[r], fXe, n, i)) {
					var s = new Error("Cannot read PKCS#12 BagAttribute.")
					throw ((s.errors = i), s)
				}
				var o = V.derToOid(n.oid)
				if (or.oids[o] !== void 0) {
					t[or.oids[o]] = []
					for (var a = 0; a < n.values.length; ++a) t[or.oids[o]].push(n.values[a].value)
				}
			}
		return t
	}
	Mb.toPkcs12Asn1 = function (e, t, r, n) {
		;(n = n || {}),
			(n.saltSize = n.saltSize || 8),
			(n.count = n.count || 2048),
			(n.algorithm = n.algorithm || n.encAlgorithm || "aes128"),
			"useMac" in n || (n.useMac = !0),
			"localKeyId" in n || (n.localKeyId = null),
			"generateLocalKeyId" in n || (n.generateLocalKeyId = !0)
		var i = n.localKeyId,
			s
		if (i !== null) i = gn.util.hexToBytes(i)
		else if (n.generateLocalKeyId)
			if (t) {
				var o = gn.util.isArray(t) ? t[0] : t
				typeof o == "string" && (o = or.certificateFromPem(o))
				var a = gn.md.sha1.create()
				a.update(V.toDer(or.certificateToAsn1(o)).getBytes()), (i = a.digest().getBytes())
			} else i = gn.random.getBytes(20)
		var l = []
		i !== null &&
			l.push(
				V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
					V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.localKeyId).getBytes()),
					V.create(V.Class.UNIVERSAL, V.Type.SET, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.OCTETSTRING, !1, i),
					]),
				]),
			),
			"friendlyName" in n &&
				l.push(
					V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.friendlyName).getBytes()),
						V.create(V.Class.UNIVERSAL, V.Type.SET, !0, [
							V.create(V.Class.UNIVERSAL, V.Type.BMPSTRING, !1, n.friendlyName),
						]),
					]),
				),
			l.length > 0 && (s = V.create(V.Class.UNIVERSAL, V.Type.SET, !0, l))
		var c = [],
			u = []
		t !== null && (gn.util.isArray(t) ? (u = t) : (u = [t]))
		for (var f = [], p = 0; p < u.length; ++p) {
			;(t = u[p]), typeof t == "string" && (t = or.certificateFromPem(t))
			var g = p === 0 ? s : void 0,
				m = or.certificateToAsn1(t),
				y = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
					V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.certBag).getBytes()),
					V.create(V.Class.CONTEXT_SPECIFIC, 0, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
							V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.x509Certificate).getBytes()),
							V.create(V.Class.CONTEXT_SPECIFIC, 0, !0, [
								V.create(V.Class.UNIVERSAL, V.Type.OCTETSTRING, !1, V.toDer(m).getBytes()),
							]),
						]),
					]),
					g,
				])
			f.push(y)
		}
		if (f.length > 0) {
			var C = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, f),
				v = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
					V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.data).getBytes()),
					V.create(V.Class.CONTEXT_SPECIFIC, 0, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.OCTETSTRING, !1, V.toDer(C).getBytes()),
					]),
				])
			c.push(v)
		}
		var b = null
		if (e !== null) {
			var w = or.wrapRsaPrivateKey(or.privateKeyToAsn1(e))
			r === null
				? (b = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.keyBag).getBytes()),
						V.create(V.Class.CONTEXT_SPECIFIC, 0, !0, [w]),
						s,
					]))
				: (b = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.pkcs8ShroudedKeyBag).getBytes()),
						V.create(V.Class.CONTEXT_SPECIFIC, 0, !0, [or.encryptPrivateKeyInfo(w, r, n)]),
						s,
					]))
			var B = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [b]),
				M = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
					V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.data).getBytes()),
					V.create(V.Class.CONTEXT_SPECIFIC, 0, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.OCTETSTRING, !1, V.toDer(B).getBytes()),
					]),
				])
			c.push(M)
		}
		var Q = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, c),
			O
		if (n.useMac) {
			var a = gn.md.sha1.create(),
				Y = new gn.util.ByteBuffer(gn.random.getBytes(n.saltSize)),
				j = n.count,
				e = Mb.generateKey(r, Y, 3, j, 20),
				ne = gn.hmac.create()
			ne.start(a, e), ne.update(V.toDer(Q).getBytes())
			var q = ne.getMac()
			O = V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
				V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
					V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
						V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.sha1).getBytes()),
						V.create(V.Class.UNIVERSAL, V.Type.NULL, !1, ""),
					]),
					V.create(V.Class.UNIVERSAL, V.Type.OCTETSTRING, !1, q.getBytes()),
				]),
				V.create(V.Class.UNIVERSAL, V.Type.OCTETSTRING, !1, Y.getBytes()),
				V.create(V.Class.UNIVERSAL, V.Type.INTEGER, !1, V.integerToDer(j).getBytes()),
			])
		}
		return V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
			V.create(V.Class.UNIVERSAL, V.Type.INTEGER, !1, V.integerToDer(3).getBytes()),
			V.create(V.Class.UNIVERSAL, V.Type.SEQUENCE, !0, [
				V.create(V.Class.UNIVERSAL, V.Type.OID, !1, V.oidToDer(or.oids.data).getBytes()),
				V.create(V.Class.CONTEXT_SPECIFIC, 0, !0, [
					V.create(V.Class.UNIVERSAL, V.Type.OCTETSTRING, !1, V.toDer(Q).getBytes()),
				]),
			]),
			O,
		])
	}
	Mb.generateKey = gn.pbe.generatePkcs12Key
})