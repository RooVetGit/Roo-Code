
var Rb = x((rBt, jle) => {
	"use strict"
	var rt = Yt()
	gc()
	Tb()
	dh()
	B5()
	T5()
	cl()
	Sr()
	typeof br > "u" && (br = rt.jsbn.BigInteger)
	var br,
		R5 = rt.util.isNodejs ? require("crypto") : null,
		ee = rt.asn1,
		dl = rt.util
	rt.pki = rt.pki || {}
	jle.exports = rt.pki.rsa = rt.rsa = rt.rsa || {}
	var kt = rt.pki,
		qZe = [6, 4, 2, 4, 2, 4, 6, 2],
		VZe = {
			name: "PrivateKeyInfo",
			tagClass: ee.Class.UNIVERSAL,
			type: ee.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "PrivateKeyInfo.version",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyVersion",
				},
				{
					name: "PrivateKeyInfo.privateKeyAlgorithm",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.SEQUENCE,
					constructed: !0,
					value: [
						{
							name: "AlgorithmIdentifier.algorithm",
							tagClass: ee.Class.UNIVERSAL,
							type: ee.Type.OID,
							constructed: !1,
							capture: "privateKeyOid",
						},
					],
				},
				{
					name: "PrivateKeyInfo",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.OCTETSTRING,
					constructed: !1,
					capture: "privateKey",
				},
			],
		},
		HZe = {
			name: "RSAPrivateKey",
			tagClass: ee.Class.UNIVERSAL,
			type: ee.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "RSAPrivateKey.version",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyVersion",
				},
				{
					name: "RSAPrivateKey.modulus",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyModulus",
				},
				{
					name: "RSAPrivateKey.publicExponent",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyPublicExponent",
				},
				{
					name: "RSAPrivateKey.privateExponent",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyPrivateExponent",
				},
				{
					name: "RSAPrivateKey.prime1",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyPrime1",
				},
				{
					name: "RSAPrivateKey.prime2",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyPrime2",
				},
				{
					name: "RSAPrivateKey.exponent1",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyExponent1",
				},
				{
					name: "RSAPrivateKey.exponent2",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyExponent2",
				},
				{
					name: "RSAPrivateKey.coefficient",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "privateKeyCoefficient",
				},
			],
		},
		WZe = {
			name: "RSAPublicKey",
			tagClass: ee.Class.UNIVERSAL,
			type: ee.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "RSAPublicKey.modulus",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "publicKeyModulus",
				},
				{
					name: "RSAPublicKey.exponent",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.INTEGER,
					constructed: !1,
					capture: "publicKeyExponent",
				},
			],
		},
		GZe = (rt.pki.rsa.publicKeyValidator = {
			name: "SubjectPublicKeyInfo",
			tagClass: ee.Class.UNIVERSAL,
			type: ee.Type.SEQUENCE,
			constructed: !0,
			captureAsn1: "subjectPublicKeyInfo",
			value: [
				{
					name: "SubjectPublicKeyInfo.AlgorithmIdentifier",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.SEQUENCE,
					constructed: !0,
					value: [
						{
							name: "AlgorithmIdentifier.algorithm",
							tagClass: ee.Class.UNIVERSAL,
							type: ee.Type.OID,
							constructed: !1,
							capture: "publicKeyOid",
						},
					],
				},
				{
					name: "SubjectPublicKeyInfo.subjectPublicKey",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.BITSTRING,
					constructed: !1,
					value: [
						{
							name: "SubjectPublicKeyInfo.subjectPublicKey.RSAPublicKey",
							tagClass: ee.Class.UNIVERSAL,
							type: ee.Type.SEQUENCE,
							constructed: !0,
							optional: !0,
							captureAsn1: "rsaPublicKey",
						},
					],
				},
			],
		}),
		$Ze = {
			name: "DigestInfo",
			tagClass: ee.Class.UNIVERSAL,
			type: ee.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "DigestInfo.DigestAlgorithm",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.SEQUENCE,
					constructed: !0,
					value: [
						{
							name: "DigestInfo.DigestAlgorithm.algorithmIdentifier",
							tagClass: ee.Class.UNIVERSAL,
							type: ee.Type.OID,
							constructed: !1,
							capture: "algorithmIdentifier",
						},
						{
							name: "DigestInfo.DigestAlgorithm.parameters",
							tagClass: ee.Class.UNIVERSAL,
							type: ee.Type.NULL,
							capture: "parameters",
							optional: !0,
							constructed: !1,
						},
					],
				},
				{
					name: "DigestInfo.digest",
					tagClass: ee.Class.UNIVERSAL,
					type: ee.Type.OCTETSTRING,
					constructed: !1,
					capture: "digest",
				},
			],
		},
		YZe = function (e) {
			var t
			if (e.algorithm in kt.oids) t = kt.oids[e.algorithm]
			else {
				var r = new Error("Unknown message digest algorithm.")
				throw ((r.algorithm = e.algorithm), r)
			}
			var n = ee.oidToDer(t).getBytes(),
				i = ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, []),
				s = ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, [])
			s.value.push(ee.create(ee.Class.UNIVERSAL, ee.Type.OID, !1, n)),
				s.value.push(ee.create(ee.Class.UNIVERSAL, ee.Type.NULL, !1, ""))
			var o = ee.create(ee.Class.UNIVERSAL, ee.Type.OCTETSTRING, !1, e.digest().getBytes())
			return i.value.push(s), i.value.push(o), ee.toDer(i).getBytes()
		},
		Jle = function (e, t, r) {
			if (r) return e.modPow(t.e, t.n)
			if (!t.p || !t.q) return e.modPow(t.d, t.n)
			t.dP || (t.dP = t.d.mod(t.p.subtract(br.ONE))),
				t.dQ || (t.dQ = t.d.mod(t.q.subtract(br.ONE))),
				t.qInv || (t.qInv = t.q.modInverse(t.p))
			var n
			do n = new br(rt.util.bytesToHex(rt.random.getBytes(t.n.bitLength() / 8)), 16)
			while (n.compareTo(t.n) >= 0 || !n.gcd(t.n).equals(br.ONE))
			e = e.multiply(n.modPow(t.e, t.n)).mod(t.n)
			for (var i = e.mod(t.p).modPow(t.dP, t.p), s = e.mod(t.q).modPow(t.dQ, t.q); i.compareTo(s) < 0; )
				i = i.add(t.p)
			var o = i.subtract(s).multiply(t.qInv).mod(t.p).multiply(t.q).add(s)
			return (o = o.multiply(n.modInverse(t.n)).mod(t.n)), o
		}
	kt.rsa.encrypt = function (e, t, r) {
		var n = r,
			i,
			s = Math.ceil(t.n.bitLength() / 8)
		r !== !1 && r !== !0 ? ((n = r === 2), (i = zle(e, t, r))) : ((i = rt.util.createBuffer()), i.putBytes(e))
		for (
			var o = new br(i.toHex(), 16),
				a = Jle(o, t, n),
				l = a.toString(16),
				c = rt.util.createBuffer(),
				u = s - Math.ceil(l.length / 2);
			u > 0;

		)
			c.putByte(0), --u
		return c.putBytes(rt.util.hexToBytes(l)), c.getBytes()
	}
	kt.rsa.decrypt = function (e, t, r, n) {
		var i = Math.ceil(t.n.bitLength() / 8)
		if (e.length !== i) {
			var s = new Error("Encrypted message length is invalid.")
			throw ((s.length = e.length), (s.expected = i), s)
		}
		var o = new br(rt.util.createBuffer(e).toHex(), 16)
		if (o.compareTo(t.n) >= 0) throw new Error("Encrypted message is invalid.")
		for (
			var a = Jle(o, t, r), l = a.toString(16), c = rt.util.createBuffer(), u = i - Math.ceil(l.length / 2);
			u > 0;

		)
			c.putByte(0), --u
		return c.putBytes(rt.util.hexToBytes(l)), n !== !1 ? yT(c.getBytes(), t, r) : c.getBytes()
	}
	kt.rsa.createKeyPairGenerationState = function (e, t, r) {
		typeof e == "string" && (e = parseInt(e, 10)), (e = e || 2048), (r = r || {})
		var n = r.prng || rt.random,
			i = {
				nextBytes: function (a) {
					for (var l = n.getBytesSync(a.length), c = 0; c < a.length; ++c) a[c] = l.charCodeAt(c)
				},
			},
			s = r.algorithm || "PRIMEINC",
			o
		if (s === "PRIMEINC")
			(o = {
				algorithm: s,
				state: 0,
				bits: e,
				rng: i,
				eInt: t || 65537,
				e: new br(null),
				p: null,
				q: null,
				qBits: e >> 1,
				pBits: e - (e >> 1),
				pqState: 0,
				num: null,
				keys: null,
			}),
				o.e.fromInt(o.eInt)
		else throw new Error("Invalid key generation algorithm: " + s)
		return o
	}
	kt.rsa.stepKeyPairGenerationState = function (e, t) {
		"algorithm" in e || (e.algorithm = "PRIMEINC")
		var r = new br(null)
		r.fromInt(30)
		for (
			var n = 0,
				i = function (f, p) {
					return f | p
				},
				s = +new Date(),
				o,
				a = 0;
			e.keys === null && (t <= 0 || a < t);

		) {
			if (e.state === 0) {
				var l = e.p === null ? e.pBits : e.qBits,
					c = l - 1
				e.pqState === 0
					? ((e.num = new br(l, e.rng)),
						e.num.testBit(c) || e.num.bitwiseTo(br.ONE.shiftLeft(c), i, e.num),
						e.num.dAddOffset(31 - e.num.mod(r).byteValue(), 0),
						(n = 0),
						++e.pqState)
					: e.pqState === 1
						? e.num.bitLength() > l
							? (e.pqState = 0)
							: e.num.isProbablePrime(JZe(e.num.bitLength()))
								? ++e.pqState
								: e.num.dAddOffset(qZe[n++ % 8], 0)
						: e.pqState === 2
							? (e.pqState = e.num.subtract(br.ONE).gcd(e.e).compareTo(br.ONE) === 0 ? 3 : 0)
							: e.pqState === 3 &&
								((e.pqState = 0),
								e.p === null ? (e.p = e.num) : (e.q = e.num),
								e.p !== null && e.q !== null && ++e.state,
								(e.num = null))
			} else if (e.state === 1) e.p.compareTo(e.q) < 0 && ((e.num = e.p), (e.p = e.q), (e.q = e.num)), ++e.state
			else if (e.state === 2)
				(e.p1 = e.p.subtract(br.ONE)), (e.q1 = e.q.subtract(br.ONE)), (e.phi = e.p1.multiply(e.q1)), ++e.state
			else if (e.state === 3)
				e.phi.gcd(e.e).compareTo(br.ONE) === 0 ? ++e.state : ((e.p = null), (e.q = null), (e.state = 0))
			else if (e.state === 4)
				(e.n = e.p.multiply(e.q)), e.n.bitLength() === e.bits ? ++e.state : ((e.q = null), (e.state = 0))
			else if (e.state === 5) {
				var u = e.e.modInverse(e.phi)
				e.keys = {
					privateKey: kt.rsa.setPrivateKey(
						e.n,
						e.e,
						u,
						e.p,
						e.q,
						u.mod(e.p1),
						u.mod(e.q1),
						e.q.modInverse(e.p),
					),
					publicKey: kt.rsa.setPublicKey(e.n, e.e),
				}
			}
			;(o = +new Date()), (a += o - s), (s = o)
		}
		return e.keys !== null
	}
	kt.rsa.generateKeyPair = function (e, t, r, n) {
		if (
			(arguments.length === 1
				? typeof e == "object"
					? ((r = e), (e = void 0))
					: typeof e == "function" && ((n = e), (e = void 0))
				: arguments.length === 2
					? typeof e == "number"
						? typeof t == "function"
							? ((n = t), (t = void 0))
							: typeof t != "number" && ((r = t), (t = void 0))
						: ((r = e), (n = t), (e = void 0), (t = void 0))
					: arguments.length === 3 &&
						(typeof t == "number"
							? typeof r == "function" && ((n = r), (r = void 0))
							: ((n = r), (r = t), (t = void 0))),
			(r = r || {}),
			e === void 0 && (e = r.bits || 2048),
			t === void 0 && (t = r.e || 65537),
			!rt.options.usePureJavaScript && !r.prng && e >= 256 && e <= 16384 && (t === 65537 || t === 3))
		) {
			if (n) {
				if (Gle("generateKeyPair"))
					return R5.generateKeyPair(
						"rsa",
						{
							modulusLength: e,
							publicExponent: t,
							publicKeyEncoding: { type: "spki", format: "pem" },
							privateKeyEncoding: { type: "pkcs8", format: "pem" },
						},
						function (a, l, c) {
							if (a) return n(a)
							n(null, {
								privateKey: kt.privateKeyFromPem(c),
								publicKey: kt.publicKeyFromPem(l),
							})
						},
					)
				if ($le("generateKey") && $le("exportKey"))
					return dl.globalScope.crypto.subtle
						.generateKey(
							{
								name: "RSASSA-PKCS1-v1_5",
								modulusLength: e,
								publicExponent: Kle(t),
								hash: { name: "SHA-256" },
							},
							!0,
							["sign", "verify"],
						)
						.then(function (a) {
							return dl.globalScope.crypto.subtle.exportKey("pkcs8", a.privateKey)
						})
						.then(void 0, function (a) {
							n(a)
						})
						.then(function (a) {
							if (a) {
								var l = kt.privateKeyFromAsn1(ee.fromDer(rt.util.createBuffer(a)))
								n(null, {
									privateKey: l,
									publicKey: kt.setRsaPublicKey(l.n, l.e),
								})
							}
						})
				if (Yle("generateKey") && Yle("exportKey")) {
					var i = dl.globalScope.msCrypto.subtle.generateKey(
						{
							name: "RSASSA-PKCS1-v1_5",
							modulusLength: e,
							publicExponent: Kle(t),
							hash: { name: "SHA-256" },
						},
						!0,
						["sign", "verify"],
					)
					;(i.oncomplete = function (a) {
						var l = a.target.result,
							c = dl.globalScope.msCrypto.subtle.exportKey("pkcs8", l.privateKey)
						;(c.oncomplete = function (u) {
							var f = u.target.result,
								p = kt.privateKeyFromAsn1(ee.fromDer(rt.util.createBuffer(f)))
							n(null, {
								privateKey: p,
								publicKey: kt.setRsaPublicKey(p.n, p.e),
							})
						}),
							(c.onerror = function (u) {
								n(u)
							})
					}),
						(i.onerror = function (a) {
							n(a)
						})
					return
				}
			} else if (Gle("generateKeyPairSync")) {
				var s = R5.generateKeyPairSync("rsa", {
					modulusLength: e,
					publicExponent: t,
					publicKeyEncoding: { type: "spki", format: "pem" },
					privateKeyEncoding: { type: "pkcs8", format: "pem" },
				})
				return {
					privateKey: kt.privateKeyFromPem(s.privateKey),
					publicKey: kt.publicKeyFromPem(s.publicKey),
				}
			}
		}
		var o = kt.rsa.createKeyPairGenerationState(e, t, r)
		if (!n) return kt.rsa.stepKeyPairGenerationState(o, 0), o.keys
		KZe(o, r, n)
	}
	kt.setRsaPublicKey = kt.rsa.setPublicKey = function (e, t) {
		var r = { n: e, e: t }
		return (
			(r.encrypt = function (n, i, s) {
				if (
					(typeof i == "string" ? (i = i.toUpperCase()) : i === void 0 && (i = "RSAES-PKCS1-V1_5"),
					i === "RSAES-PKCS1-V1_5")
				)
					i = {
						encode: function (a, l, c) {
							return zle(a, l, 2).getBytes()
						},
					}
				else if (i === "RSA-OAEP" || i === "RSAES-OAEP")
					i = {
						encode: function (a, l) {
							return rt.pkcs1.encode_rsa_oaep(l, a, s)
						},
					}
				else if (["RAW", "NONE", "NULL", null].indexOf(i) !== -1)
					i = {
						encode: function (a) {
							return a
						},
					}
				else if (typeof i == "string") throw new Error('Unsupported encryption scheme: "' + i + '".')
				var o = i.encode(n, r, !0)
				return kt.rsa.encrypt(o, r, !0)
			}),
			(r.verify = function (n, i, s, o) {
				typeof s == "string" ? (s = s.toUpperCase()) : s === void 0 && (s = "RSASSA-PKCS1-V1_5"),
					o === void 0 && (o = { _parseAllDigestBytes: !0 }),
					"_parseAllDigestBytes" in o || (o._parseAllDigestBytes = !0),
					s === "RSASSA-PKCS1-V1_5"
						? (s = {
								verify: function (l, c) {
									c = yT(c, r, !0)
									var u = ee.fromDer(c, {
											parseAllBytes: o._parseAllDigestBytes,
										}),
										f = {},
										p = []
									if (!ee.validate(u, $Ze, f, p)) {
										var g = new Error(
											"ASN.1 object does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo value.",
										)
										throw ((g.errors = p), g)
									}
									var m = ee.derToOid(f.algorithmIdentifier)
									if (
										!(
											m === rt.oids.md2 ||
											m === rt.oids.md5 ||
											m === rt.oids.sha1 ||
											m === rt.oids.sha224 ||
											m === rt.oids.sha256 ||
											m === rt.oids.sha384 ||
											m === rt.oids.sha512 ||
											m === rt.oids["sha512-224"] ||
											m === rt.oids["sha512-256"]
										)
									) {
										var g = new Error("Unknown RSASSA-PKCS1-v1_5 DigestAlgorithm identifier.")
										throw ((g.oid = m), g)
									}
									if ((m === rt.oids.md2 || m === rt.oids.md5) && !("parameters" in f))
										throw new Error(
											"ASN.1 object does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo value. Missing algorithm identifer NULL parameters.",
										)
									return l === f.digest
								},
							})
						: (s === "NONE" || s === "NULL" || s === null) &&
							(s = {
								verify: function (l, c) {
									return (c = yT(c, r, !0)), l === c
								},
							})
				var a = kt.rsa.decrypt(i, r, !0, !1)
				return s.verify(n, a, r.n.bitLength())
			}),
			r
		)
	}
	kt.setRsaPrivateKey = kt.rsa.setPrivateKey = function (e, t, r, n, i, s, o, a) {
		var l = { n: e, e: t, d: r, p: n, q: i, dP: s, dQ: o, qInv: a }
		return (
			(l.decrypt = function (c, u, f) {
				typeof u == "string" ? (u = u.toUpperCase()) : u === void 0 && (u = "RSAES-PKCS1-V1_5")
				var p = kt.rsa.decrypt(c, l, !1, !1)
				if (u === "RSAES-PKCS1-V1_5") u = { decode: yT }
				else if (u === "RSA-OAEP" || u === "RSAES-OAEP")
					u = {
						decode: function (g, m) {
							return rt.pkcs1.decode_rsa_oaep(m, g, f)
						},
					}
				else if (["RAW", "NONE", "NULL", null].indexOf(u) !== -1)
					u = {
						decode: function (g) {
							return g
						},
					}
				else throw new Error('Unsupported encryption scheme: "' + u + '".')
				return u.decode(p, l, !1)
			}),
			(l.sign = function (c, u) {
				var f = !1
				typeof u == "string" && (u = u.toUpperCase()),
					u === void 0 || u === "RSASSA-PKCS1-V1_5"
						? ((u = { encode: YZe }), (f = 1))
						: (u === "NONE" || u === "NULL" || u === null) &&
							((u = {
								encode: function () {
									return c
								},
							}),
							(f = 1))
				var p = u.encode(c, l.n.bitLength())
				return kt.rsa.encrypt(p, l, f)
			}),
			l
		)
	}
	kt.wrapRsaPrivateKey = function (e) {
		return ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, [
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, ee.integerToDer(0).getBytes()),
			ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, [
				ee.create(ee.Class.UNIVERSAL, ee.Type.OID, !1, ee.oidToDer(kt.oids.rsaEncryption).getBytes()),
				ee.create(ee.Class.UNIVERSAL, ee.Type.NULL, !1, ""),
			]),
			ee.create(ee.Class.UNIVERSAL, ee.Type.OCTETSTRING, !1, ee.toDer(e).getBytes()),
		])
	}
	kt.privateKeyFromAsn1 = function (e) {
		var t = {},
			r = []
		if (
			(ee.validate(e, VZe, t, r) && (e = ee.fromDer(rt.util.createBuffer(t.privateKey))),
			(t = {}),
			(r = []),
			!ee.validate(e, HZe, t, r))
		) {
			var n = new Error("Cannot read private key. ASN.1 object does not contain an RSAPrivateKey.")
			throw ((n.errors = r), n)
		}
		var i, s, o, a, l, c, u, f
		return (
			(i = rt.util.createBuffer(t.privateKeyModulus).toHex()),
			(s = rt.util.createBuffer(t.privateKeyPublicExponent).toHex()),
			(o = rt.util.createBuffer(t.privateKeyPrivateExponent).toHex()),
			(a = rt.util.createBuffer(t.privateKeyPrime1).toHex()),
			(l = rt.util.createBuffer(t.privateKeyPrime2).toHex()),
			(c = rt.util.createBuffer(t.privateKeyExponent1).toHex()),
			(u = rt.util.createBuffer(t.privateKeyExponent2).toHex()),
			(f = rt.util.createBuffer(t.privateKeyCoefficient).toHex()),
			kt.setRsaPrivateKey(
				new br(i, 16),
				new br(s, 16),
				new br(o, 16),
				new br(a, 16),
				new br(l, 16),
				new br(c, 16),
				new br(u, 16),
				new br(f, 16),
			)
		)
	}
	kt.privateKeyToAsn1 = kt.privateKeyToRSAPrivateKey = function (e) {
		return ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, [
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, ee.integerToDer(0).getBytes()),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.n)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.e)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.d)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.p)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.q)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.dP)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.dQ)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.qInv)),
		])
	}
	kt.publicKeyFromAsn1 = function (e) {
		var t = {},
			r = []
		if (ee.validate(e, GZe, t, r)) {
			var n = ee.derToOid(t.publicKeyOid)
			if (n !== kt.oids.rsaEncryption) {
				var i = new Error("Cannot read public key. Unknown OID.")
				throw ((i.oid = n), i)
			}
			e = t.rsaPublicKey
		}
		if (((r = []), !ee.validate(e, WZe, t, r))) {
			var i = new Error("Cannot read public key. ASN.1 object does not contain an RSAPublicKey.")
			throw ((i.errors = r), i)
		}
		var s = rt.util.createBuffer(t.publicKeyModulus).toHex(),
			o = rt.util.createBuffer(t.publicKeyExponent).toHex()
		return kt.setRsaPublicKey(new br(s, 16), new br(o, 16))
	}
	kt.publicKeyToAsn1 = kt.publicKeyToSubjectPublicKeyInfo = function (e) {
		return ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, [
			ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, [
				ee.create(ee.Class.UNIVERSAL, ee.Type.OID, !1, ee.oidToDer(kt.oids.rsaEncryption).getBytes()),
				ee.create(ee.Class.UNIVERSAL, ee.Type.NULL, !1, ""),
			]),
			ee.create(ee.Class.UNIVERSAL, ee.Type.BITSTRING, !1, [kt.publicKeyToRSAPublicKey(e)]),
		])
	}
	kt.publicKeyToRSAPublicKey = function (e) {
		return ee.create(ee.Class.UNIVERSAL, ee.Type.SEQUENCE, !0, [
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.n)),
			ee.create(ee.Class.UNIVERSAL, ee.Type.INTEGER, !1, yu(e.e)),
		])
	}
	function zle(e, t, r) {
		var n = rt.util.createBuffer(),
			i = Math.ceil(t.n.bitLength() / 8)
		if (e.length > i - 11) {
			var s = new Error("Message is too long for PKCS#1 v1.5 padding.")
			throw ((s.length = e.length), (s.max = i - 11), s)
		}
		n.putByte(0), n.putByte(r)
		var o = i - 3 - e.length,
			a
		if (r === 0 || r === 1) {
			a = r === 0 ? 0 : 255
			for (var l = 0; l < o; ++l) n.putByte(a)
		} else
			for (; o > 0; ) {
				for (var c = 0, u = rt.random.getBytes(o), l = 0; l < o; ++l)
					(a = u.charCodeAt(l)), a === 0 ? ++c : n.putByte(a)
				o = c
			}
		return n.putByte(0), n.putBytes(e), n
	}
	function yT(e, t, r, n) {
		var i = Math.ceil(t.n.bitLength() / 8),
			s = rt.util.createBuffer(e),
			o = s.getByte(),
			a = s.getByte()
		if (o !== 0 || (r && a !== 0 && a !== 1) || (!r && a != 2) || (r && a === 0 && typeof n > "u"))
			throw new Error("Encryption block is invalid.")
		var l = 0
		if (a === 0) {
			l = i - 3 - n
			for (var c = 0; c < l; ++c) if (s.getByte() !== 0) throw new Error("Encryption block is invalid.")
		} else if (a === 1)
			for (l = 0; s.length() > 1; ) {
				if (s.getByte() !== 255) {
					--s.read
					break
				}
				++l
			}
		else if (a === 2)
			for (l = 0; s.length() > 1; ) {
				if (s.getByte() === 0) {
					--s.read
					break
				}
				++l
			}
		var u = s.getByte()
		if (u !== 0 || l !== i - 3 - s.length()) throw new Error("Encryption block is invalid.")
		return s.getBytes()
	}
	function KZe(e, t, r) {
		typeof t == "function" && ((r = t), (t = {})), (t = t || {})
		var n = {
			algorithm: {
				name: t.algorithm || "PRIMEINC",
				options: {
					workers: t.workers || 2,
					workLoad: t.workLoad || 100,
					workerScript: t.workerScript,
				},
			},
		}
		"prng" in t && (n.prng = t.prng), i()
		function i() {
			s(e.pBits, function (a, l) {
				if (a) return r(a)
				if (((e.p = l), e.q !== null)) return o(a, e.q)
				s(e.qBits, o)
			})
		}
		function s(a, l) {
			rt.prime.generateProbablePrime(a, n, l)
		}
		function o(a, l) {
			if (a) return r(a)
			if (((e.q = l), e.p.compareTo(e.q) < 0)) {
				var c = e.p
				;(e.p = e.q), (e.q = c)
			}
			if (e.p.subtract(br.ONE).gcd(e.e).compareTo(br.ONE) !== 0) {
				;(e.p = null), i()
				return
			}
			if (e.q.subtract(br.ONE).gcd(e.e).compareTo(br.ONE) !== 0) {
				;(e.q = null), s(e.qBits, o)
				return
			}
			if (
				((e.p1 = e.p.subtract(br.ONE)),
				(e.q1 = e.q.subtract(br.ONE)),
				(e.phi = e.p1.multiply(e.q1)),
				e.phi.gcd(e.e).compareTo(br.ONE) !== 0)
			) {
				;(e.p = e.q = null), i()
				return
			}
			if (((e.n = e.p.multiply(e.q)), e.n.bitLength() !== e.bits)) {
				;(e.q = null), s(e.qBits, o)
				return
			}
			var u = e.e.modInverse(e.phi)
			;(e.keys = {
				privateKey: kt.rsa.setPrivateKey(e.n, e.e, u, e.p, e.q, u.mod(e.p1), u.mod(e.q1), e.q.modInverse(e.p)),
				publicKey: kt.rsa.setPublicKey(e.n, e.e),
			}),
				r(null, e.keys)
		}
	}
	function yu(e) {
		var t = e.toString(16)
		t[0] >= "8" && (t = "00" + t)
		var r = rt.util.hexToBytes(t)
		return r.length > 1 &&
			((r.charCodeAt(0) === 0 && !(r.charCodeAt(1) & 128)) ||
				(r.charCodeAt(0) === 255 && (r.charCodeAt(1) & 128) === 128))
			? r.substr(1)
			: r
	}
	function JZe(e) {
		return e <= 100
			? 27
			: e <= 150
				? 18
				: e <= 200
					? 15
					: e <= 250
						? 12
						: e <= 300
							? 9
							: e <= 350
								? 8
								: e <= 400
									? 7
									: e <= 500
										? 6
										: e <= 600
											? 5
											: e <= 800
												? 4
												: e <= 1250
													? 3
													: 2
	}
	function Gle(e) {
		return rt.util.isNodejs && typeof R5[e] == "function"
	}
	function $le(e) {
		return (
			typeof dl.globalScope < "u" &&
			typeof dl.globalScope.crypto == "object" &&
			typeof dl.globalScope.crypto.subtle == "object" &&
			typeof dl.globalScope.crypto.subtle[e] == "function"
		)
	}
	function Yle(e) {
		return (
			typeof dl.globalScope < "u" &&
			typeof dl.globalScope.msCrypto == "object" &&
			typeof dl.globalScope.msCrypto.subtle == "object" &&
			typeof dl.globalScope.msCrypto.subtle[e] == "function"
		)
	}
	function Kle(e) {
		for (var t = rt.util.hexToBytes(e.toString(16)), r = new Uint8Array(t.length), n = 0; n < t.length; ++n)
			r[n] = t.charCodeAt(n)
		return r
	}
})