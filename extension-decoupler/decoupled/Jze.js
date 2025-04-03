
	var Sp = Wt.oids,
		zZe = {
			name: "EncryptedPrivateKeyInfo",
			tagClass: ae.Class.UNIVERSAL,
			type: ae.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "EncryptedPrivateKeyInfo.encryptionAlgorithm",
					tagClass: ae.Class.UNIVERSAL,
					type: ae.Type.SEQUENCE,
					constructed: !0,
					value: [
						{
							name: "AlgorithmIdentifier.algorithm",
							tagClass: ae.Class.UNIVERSAL,
							type: ae.Type.OID,
							constructed: !1,
							capture: "encryptionOid",
						},
						{
							name: "AlgorithmIdentifier.parameters",
							tagClass: ae.Class.UNIVERSAL,
							type: ae.Type.SEQUENCE,
							constructed: !0,
							captureAsn1: "encryptionParams",
						},
					],
				},
				{
					name: "EncryptedPrivateKeyInfo.encryptedData",
					tagClass: ae.Class.UNIVERSAL,
					type: ae.Type.OCTETSTRING,
					constructed: !1,
					capture: "encryptedData",
				},
			],
		},
		jZe = {
			name: "PBES2Algorithms",
			tagClass: ae.Class.UNIVERSAL,
			type: ae.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "PBES2Algorithms.keyDerivationFunc",
					tagClass: ae.Class.UNIVERSAL,
					type: ae.Type.SEQUENCE,
					constructed: !0,
					value: [
						{
							name: "PBES2Algorithms.keyDerivationFunc.oid",
							tagClass: ae.Class.UNIVERSAL,
							type: ae.Type.OID,
							constructed: !1,
							capture: "kdfOid",
						},
						{
							name: "PBES2Algorithms.params",
							tagClass: ae.Class.UNIVERSAL,
							type: ae.Type.SEQUENCE,
							constructed: !0,
							value: [
								{
									name: "PBES2Algorithms.params.salt",
									tagClass: ae.Class.UNIVERSAL,
									type: ae.Type.OCTETSTRING,
									constructed: !1,
									capture: "kdfSalt",
								},
								{
									name: "PBES2Algorithms.params.iterationCount",
									tagClass: ae.Class.UNIVERSAL,
									type: ae.Type.INTEGER,
									constructed: !1,
									capture: "kdfIterationCount",
								},
								{
									name: "PBES2Algorithms.params.keyLength",
									tagClass: ae.Class.UNIVERSAL,
									type: ae.Type.INTEGER,
									constructed: !1,
									optional: !0,
									capture: "keyLength",
								},
								{
									name: "PBES2Algorithms.params.prf",
									tagClass: ae.Class.UNIVERSAL,
									type: ae.Type.SEQUENCE,
									constructed: !0,
									optional: !0,
									value: [
										{
											name: "PBES2Algorithms.params.prf.algorithm",
											tagClass: ae.Class.UNIVERSAL,
											type: ae.Type.OID,
											constructed: !1,
											capture: "prfOid",
										},
									],
								},
							],
						},
					],
				},
				{
					name: "PBES2Algorithms.encryptionScheme",
					tagClass: ae.Class.UNIVERSAL,
					type: ae.Type.SEQUENCE,
					constructed: !0,
					value: [
						{
							name: "PBES2Algorithms.encryptionScheme.oid",
							tagClass: ae.Class.UNIVERSAL,
							type: ae.Type.OID,
							constructed: !1,
							capture: "encOid",
						},
						{
							name: "PBES2Algorithms.encryptionScheme.iv",
							tagClass: ae.Class.UNIVERSAL,
							type: ae.Type.OCTETSTRING,
							constructed: !1,
							capture: "encIv",
						},
					],
				},
			],
		},
		ZZe = {
			name: "pkcs-12PbeParams",
			tagClass: ae.Class.UNIVERSAL,
			type: ae.Type.SEQUENCE,
			constructed: !0,
			value: [
				{
					name: "pkcs-12PbeParams.salt",
					tagClass: ae.Class.UNIVERSAL,
					type: ae.Type.OCTETSTRING,
					constructed: !1,
					capture: "salt",
				},
				{
					name: "pkcs-12PbeParams.iterations",
					tagClass: ae.Class.UNIVERSAL,
					type: ae.Type.INTEGER,
					constructed: !1,
					capture: "iterations",
				},
			],
		}