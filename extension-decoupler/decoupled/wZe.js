
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