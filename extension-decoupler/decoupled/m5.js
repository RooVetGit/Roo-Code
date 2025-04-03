
var M5 = x((iBt, sce) => {
	"use strict"
	var G0 = Yt()
	gc()
	Sr()
	var Fe = G0.asn1,
		$0 = (sce.exports = G0.pkcs7asn1 = G0.pkcs7asn1 || {})
	G0.pkcs7 = G0.pkcs7 || {}
	G0.pkcs7.asn1 = $0
	var nce = {
		name: "ContentInfo",
		tagClass: Fe.Class.UNIVERSAL,
		type: Fe.Type.SEQUENCE,
		constructed: !0,
		value: [
			{
				name: "ContentInfo.ContentType",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.OID,
				constructed: !1,
				capture: "contentType",
			},
			{
				name: "ContentInfo.content",
				tagClass: Fe.Class.CONTEXT_SPECIFIC,
				type: 0,
				constructed: !0,
				optional: !0,
				captureAsn1: "content",
			},
		],
	}
	$0.contentInfoValidator = nce
	var ice = {
		name: "EncryptedContentInfo",
		tagClass: Fe.Class.UNIVERSAL,
		type: Fe.Type.SEQUENCE,
		constructed: !0,
		value: [
			{
				name: "EncryptedContentInfo.contentType",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.OID,
				constructed: !1,
				capture: "contentType",
			},
			{
				name: "EncryptedContentInfo.contentEncryptionAlgorithm",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SEQUENCE,
				constructed: !0,
				value: [
					{
						name: "EncryptedContentInfo.contentEncryptionAlgorithm.algorithm",
						tagClass: Fe.Class.UNIVERSAL,
						type: Fe.Type.OID,
						constructed: !1,
						capture: "encAlgorithm",
					},
					{
						name: "EncryptedContentInfo.contentEncryptionAlgorithm.parameter",
						tagClass: Fe.Class.UNIVERSAL,
						captureAsn1: "encParameter",
					},
				],
			},
			{
				name: "EncryptedContentInfo.encryptedContent",
				tagClass: Fe.Class.CONTEXT_SPECIFIC,
				type: 0,
				capture: "encryptedContent",
				captureAsn1: "encryptedContentAsn1",
			},
		],
	}
	$0.envelopedDataValidator = {
		name: "EnvelopedData",
		tagClass: Fe.Class.UNIVERSAL,
		type: Fe.Type.SEQUENCE,
		constructed: !0,
		value: [
			{
				name: "EnvelopedData.Version",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.INTEGER,
				constructed: !1,
				capture: "version",
			},
			{
				name: "EnvelopedData.RecipientInfos",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SET,
				constructed: !0,
				captureAsn1: "recipientInfos",
			},
		].concat(ice),
	}
	$0.encryptedDataValidator = {
		name: "EncryptedData",
		tagClass: Fe.Class.UNIVERSAL,
		type: Fe.Type.SEQUENCE,
		constructed: !0,
		value: [
			{
				name: "EncryptedData.Version",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.INTEGER,
				constructed: !1,
				capture: "version",
			},
		].concat(ice),
	}
	var eXe = {
		name: "SignerInfo",
		tagClass: Fe.Class.UNIVERSAL,
		type: Fe.Type.SEQUENCE,
		constructed: !0,
		value: [
			{
				name: "SignerInfo.version",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.INTEGER,
				constructed: !1,
			},
			{
				name: "SignerInfo.issuerAndSerialNumber",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SEQUENCE,
				constructed: !0,
				value: [
					{
						name: "SignerInfo.issuerAndSerialNumber.issuer",
						tagClass: Fe.Class.UNIVERSAL,
						type: Fe.Type.SEQUENCE,
						constructed: !0,
						captureAsn1: "issuer",
					},
					{
						name: "SignerInfo.issuerAndSerialNumber.serialNumber",
						tagClass: Fe.Class.UNIVERSAL,
						type: Fe.Type.INTEGER,
						constructed: !1,
						capture: "serial",
					},
				],
			},
			{
				name: "SignerInfo.digestAlgorithm",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SEQUENCE,
				constructed: !0,
				value: [
					{
						name: "SignerInfo.digestAlgorithm.algorithm",
						tagClass: Fe.Class.UNIVERSAL,
						type: Fe.Type.OID,
						constructed: !1,
						capture: "digestAlgorithm",
					},
					{
						name: "SignerInfo.digestAlgorithm.parameter",
						tagClass: Fe.Class.UNIVERSAL,
						constructed: !1,
						captureAsn1: "digestParameter",
						optional: !0,
					},
				],
			},
			{
				name: "SignerInfo.authenticatedAttributes",
				tagClass: Fe.Class.CONTEXT_SPECIFIC,
				type: 0,
				constructed: !0,
				optional: !0,
				capture: "authenticatedAttributes",
			},
			{
				name: "SignerInfo.digestEncryptionAlgorithm",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SEQUENCE,
				constructed: !0,
				capture: "signatureAlgorithm",
			},
			{
				name: "SignerInfo.encryptedDigest",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.OCTETSTRING,
				constructed: !1,
				capture: "signature",
			},
			{
				name: "SignerInfo.unauthenticatedAttributes",
				tagClass: Fe.Class.CONTEXT_SPECIFIC,
				type: 1,
				constructed: !0,
				optional: !0,
				capture: "unauthenticatedAttributes",
			},
		],
	}
	$0.signedDataValidator = {
		name: "SignedData",
		tagClass: Fe.Class.UNIVERSAL,
		type: Fe.Type.SEQUENCE,
		constructed: !0,
		value: [
			{
				name: "SignedData.Version",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.INTEGER,
				constructed: !1,
				capture: "version",
			},
			{
				name: "SignedData.DigestAlgorithms",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SET,
				constructed: !0,
				captureAsn1: "digestAlgorithms",
			},
			nce,
			{
				name: "SignedData.Certificates",
				tagClass: Fe.Class.CONTEXT_SPECIFIC,
				type: 0,
				optional: !0,
				captureAsn1: "certificates",
			},
			{
				name: "SignedData.CertificateRevocationLists",
				tagClass: Fe.Class.CONTEXT_SPECIFIC,
				type: 1,
				optional: !0,
				captureAsn1: "crls",
			},
			{
				name: "SignedData.SignerInfos",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SET,
				capture: "signerInfos",
				optional: !0,
				value: [eXe],
			},
		],
	}
	$0.recipientInfoValidator = {
		name: "RecipientInfo",
		tagClass: Fe.Class.UNIVERSAL,
		type: Fe.Type.SEQUENCE,
		constructed: !0,
		value: [
			{
				name: "RecipientInfo.version",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.INTEGER,
				constructed: !1,
				capture: "version",
			},
			{
				name: "RecipientInfo.issuerAndSerial",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SEQUENCE,
				constructed: !0,
				value: [
					{
						name: "RecipientInfo.issuerAndSerial.issuer",
						tagClass: Fe.Class.UNIVERSAL,
						type: Fe.Type.SEQUENCE,
						constructed: !0,
						captureAsn1: "issuer",
					},
					{
						name: "RecipientInfo.issuerAndSerial.serialNumber",
						tagClass: Fe.Class.UNIVERSAL,
						type: Fe.Type.INTEGER,
						constructed: !1,
						capture: "serial",
					},
				],
			},
			{
				name: "RecipientInfo.keyEncryptionAlgorithm",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.SEQUENCE,
				constructed: !0,
				value: [
					{
						name: "RecipientInfo.keyEncryptionAlgorithm.algorithm",
						tagClass: Fe.Class.UNIVERSAL,
						type: Fe.Type.OID,
						constructed: !1,
						capture: "encAlgorithm",
					},
					{
						name: "RecipientInfo.keyEncryptionAlgorithm.parameter",
						tagClass: Fe.Class.UNIVERSAL,
						constructed: !1,
						captureAsn1: "encParameter",
						optional: !0,
					},
				],
			},
			{
				name: "RecipientInfo.encryptedKey",
				tagClass: Fe.Class.UNIVERSAL,
				type: Fe.Type.OCTETSTRING,
				constructed: !1,
				capture: "encKey",
			},
		],
	}
})