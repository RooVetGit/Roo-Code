
var G5 = x((dBt, wce) => {
	"use strict"
	var pe = Yt()
	gc()
	O0()
	cT()
	_p()
	U5()
	cl()
	W0()
	Sr()
	var ST = function (e, t, r, n) {
			var i = pe.util.createBuffer(),
				s = e.length >> 1,
				o = s + (e.length & 1),
				a = e.substr(0, o),
				l = e.substr(s, o),
				c = pe.util.createBuffer(),
				u = pe.hmac.create()
			r = t + r
			var f = Math.ceil(n / 16),
				p = Math.ceil(n / 20)
			u.start("MD5", a)
			var g = pe.util.createBuffer()
			c.putBytes(r)
			for (var m = 0; m < f; ++m)
				u.start(null, null),
					u.update(c.getBytes()),
					c.putBuffer(u.digest()),
					u.start(null, null),
					u.update(c.bytes() + r),
					g.putBuffer(u.digest())
			u.start("SHA1", l)
			var y = pe.util.createBuffer()
			c.clear(), c.putBytes(r)
			for (var m = 0; m < p; ++m)
				u.start(null, null),
					u.update(c.getBytes()),
					c.putBuffer(u.digest()),
					u.start(null, null),
					u.update(c.bytes() + r),
					y.putBuffer(u.digest())
			return i.putBytes(pe.util.xorBytes(g.getBytes(), y.getBytes(), n)), i
		},
		yXe = function (e, t, r) {
			var n = pe.hmac.create()
			n.start("SHA1", e)
			var i = pe.util.createBuffer()
			return (
				i.putInt32(t[0]),
				i.putInt32(t[1]),
				i.putByte(r.type),
				i.putByte(r.version.major),
				i.putByte(r.version.minor),
				i.putInt16(r.length),
				i.putBytes(r.fragment.bytes()),
				n.update(i.getBytes()),
				n.digest().getBytes()
			)
		},
		CXe = function (e, t, r) {
			var n = !1
			try {
				var i = e.deflate(t.fragment.getBytes())
				;(t.fragment = pe.util.createBuffer(i)), (t.length = i.length), (n = !0)
			} catch {}
			return n
		},
		vXe = function (e, t, r) {
			var n = !1
			try {
				var i = e.inflate(t.fragment.getBytes())
				;(t.fragment = pe.util.createBuffer(i)), (t.length = i.length), (n = !0)
			} catch {}
			return n
		},
		ba = function (e, t) {
			var r = 0
			switch (t) {
				case 1:
					r = e.getByte()
					break
				case 2:
					r = e.getInt16()
					break
				case 3:
					r = e.getInt24()
					break
				case 4:
					r = e.getInt32()
					break
			}
			return pe.util.createBuffer(e.getBytes(r))
		},
		hl = function (e, t, r) {
			e.putInt(r.length(), t << 3), e.putBuffer(r)
		},
		k = {}
	k.Versions = {
		TLS_1_0: { major: 3, minor: 1 },
		TLS_1_1: { major: 3, minor: 2 },
		TLS_1_2: { major: 3, minor: 3 },
	}
	k.SupportedVersions = [k.Versions.TLS_1_1, k.Versions.TLS_1_0]
	k.Version = k.SupportedVersions[0]
	k.MaxFragment = 15360
	k.ConnectionEnd = { server: 0, client: 1 }
	k.PRFAlgorithm = { tls_prf_sha256: 0 }
	k.BulkCipherAlgorithm = { none: null, rc4: 0, des3: 1, aes: 2 }
	k.CipherType = { stream: 0, block: 1, aead: 2 }
	k.MACAlgorithm = {
		none: null,
		hmac_md5: 0,
		hmac_sha1: 1,
		hmac_sha256: 2,
		hmac_sha384: 3,
		hmac_sha512: 4,
	}
	k.CompressionMethod = { none: 0, deflate: 1 }
	k.ContentType = {
		change_cipher_spec: 20,
		alert: 21,
		handshake: 22,
		application_data: 23,
		heartbeat: 24,
	}
	k.HandshakeType = {
		hello_request: 0,
		client_hello: 1,
		server_hello: 2,
		certificate: 11,
		server_key_exchange: 12,
		certificate_request: 13,
		server_hello_done: 14,
		certificate_verify: 15,
		client_key_exchange: 16,
		finished: 20,
	}
	k.Alert = {}
	k.Alert.Level = { warning: 1, fatal: 2 }
	k.Alert.Description = {
		close_notify: 0,
		unexpected_message: 10,
		bad_record_mac: 20,
		decryption_failed: 21,
		record_overflow: 22,
		decompression_failure: 30,
		handshake_failure: 40,
		bad_certificate: 42,
		unsupported_certificate: 43,
		certificate_revoked: 44,
		certificate_expired: 45,
		certificate_unknown: 46,
		illegal_parameter: 47,
		unknown_ca: 48,
		access_denied: 49,
		decode_error: 50,
		decrypt_error: 51,
		export_restriction: 60,
		protocol_version: 70,
		insufficient_security: 71,
		internal_error: 80,
		user_canceled: 90,
		no_renegotiation: 100,
	}
	k.HeartbeatMessageType = { heartbeat_request: 1, heartbeat_response: 2 }
	k.CipherSuites = {}
	k.getCipherSuite = function (e) {
		var t = null
		for (var r in k.CipherSuites) {
			var n = k.CipherSuites[r]
			if (n.id[0] === e.charCodeAt(0) && n.id[1] === e.charCodeAt(1)) {
				t = n
				break
			}
		}
		return t
	}
	k.handleUnexpected = function (e, t) {
		var r = !e.open && e.entity === k.ConnectionEnd.client
		r ||
			e.error(e, {
				message: "Unexpected message. Received TLS record out of order.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.unexpected_message,
				},
			})
	}
	k.handleHelloRequest = function (e, t, r) {
		!e.handshaking &&
			e.handshakes > 0 &&
			(k.queue(
				e,
				k.createAlert(e, {
					level: k.Alert.Level.warning,
					description: k.Alert.Description.no_renegotiation,
				}),
			),
			k.flush(e)),
			e.process()
	}
	k.parseHelloMessage = function (e, t, r) {
		var n = null,
			i = e.entity === k.ConnectionEnd.client
		if (r < 38)
			e.error(e, {
				message: i
					? "Invalid ServerHello message. Message too short."
					: "Invalid ClientHello message. Message too short.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.illegal_parameter,
				},
			})
		else {
			var s = t.fragment,
				o = s.length()
			if (
				((n = {
					version: { major: s.getByte(), minor: s.getByte() },
					random: pe.util.createBuffer(s.getBytes(32)),
					session_id: ba(s, 1),
					extensions: [],
				}),
				i
					? ((n.cipher_suite = s.getBytes(2)), (n.compression_method = s.getByte()))
					: ((n.cipher_suites = ba(s, 2)), (n.compression_methods = ba(s, 1))),
				(o = r - (o - s.length())),
				o > 0)
			) {
				for (var a = ba(s, 2); a.length() > 0; )
					n.extensions.push({
						type: [a.getByte(), a.getByte()],
						data: ba(a, 2),
					})
				if (!i)
					for (var l = 0; l < n.extensions.length; ++l) {
						var c = n.extensions[l]
						if (c.type[0] === 0 && c.type[1] === 0)
							for (var u = ba(c.data, 2); u.length() > 0; ) {
								var f = u.getByte()
								if (f !== 0) break
								e.session.extensions.server_name.serverNameList.push(ba(u, 2).getBytes())
							}
					}
			}
			if (
				e.session.version &&
				(n.version.major !== e.session.version.major || n.version.minor !== e.session.version.minor)
			)
				return e.error(e, {
					message: "TLS version change is disallowed during renegotiation.",
					send: !0,
					alert: {
						level: k.Alert.Level.fatal,
						description: k.Alert.Description.protocol_version,
					},
				})
			if (i) e.session.cipherSuite = k.getCipherSuite(n.cipher_suite)
			else
				for (
					var p = pe.util.createBuffer(n.cipher_suites.bytes());
					p.length() > 0 &&
					((e.session.cipherSuite = k.getCipherSuite(p.getBytes(2))), e.session.cipherSuite === null);

				);
			if (e.session.cipherSuite === null)
				return e.error(e, {
					message: "No cipher suites in common.",
					send: !0,
					alert: {
						level: k.Alert.Level.fatal,
						description: k.Alert.Description.handshake_failure,
					},
					cipherSuite: pe.util.bytesToHex(n.cipher_suite),
				})
			i
				? (e.session.compressionMethod = n.compression_method)
				: (e.session.compressionMethod = k.CompressionMethod.none)
		}
		return n
	}
	k.createSecurityParameters = function (e, t) {
		var r = e.entity === k.ConnectionEnd.client,
			n = t.random.bytes(),
			i = r ? e.session.sp.client_random : n,
			s = r ? n : k.createRandom().getBytes()
		e.session.sp = {
			entity: e.entity,
			prf_algorithm: k.PRFAlgorithm.tls_prf_sha256,
			bulk_cipher_algorithm: null,
			cipher_type: null,
			enc_key_length: null,
			block_length: null,
			fixed_iv_length: null,
			record_iv_length: null,
			mac_algorithm: null,
			mac_length: null,
			mac_key_length: null,
			compression_algorithm: e.session.compressionMethod,
			pre_master_secret: null,
			master_secret: null,
			client_random: i,
			server_random: s,
		}
	}
	k.handleServerHello = function (e, t, r) {
		var n = k.parseHelloMessage(e, t, r)
		if (!e.fail) {
			if (n.version.minor <= e.version.minor) e.version.minor = n.version.minor
			else
				return e.error(e, {
					message: "Incompatible TLS version.",
					send: !0,
					alert: {
						level: k.Alert.Level.fatal,
						description: k.Alert.Description.protocol_version,
					},
				})
			e.session.version = e.version
			var i = n.session_id.bytes()
			i.length > 0 && i === e.session.id
				? ((e.expect = vce), (e.session.resuming = !0), (e.session.sp.server_random = n.random.bytes()))
				: ((e.expect = bXe), (e.session.resuming = !1), k.createSecurityParameters(e, n)),
				(e.session.id = i),
				e.process()
		}
	}
	k.handleClientHello = function (e, t, r) {
		var n = k.parseHelloMessage(e, t, r)
		if (!e.fail) {
			var i = n.session_id.bytes(),
				s = null
			if (
				(e.sessionCache &&
					((s = e.sessionCache.getSession(i)),
					s === null
						? (i = "")
						: (s.version.major !== n.version.major || s.version.minor > n.version.minor) &&
							((s = null), (i = ""))),
				i.length === 0 && (i = pe.random.getBytes(32)),
				(e.session.id = i),
				(e.session.clientHelloVersion = n.version),
				(e.session.sp = {}),
				s)
			)
				(e.version = e.session.version = s.version), (e.session.sp = s.sp)
			else {
				for (
					var o, a = 1;
					a < k.SupportedVersions.length && ((o = k.SupportedVersions[a]), !(o.minor <= n.version.minor));
					++a
				);
				;(e.version = { major: o.major, minor: o.minor }), (e.session.version = e.version)
			}
			s !== null
				? ((e.expect = H5), (e.session.resuming = !0), (e.session.sp.client_random = n.random.bytes()))
				: ((e.expect = e.verifyClient !== !1 ? DXe : V5),
					(e.session.resuming = !1),
					k.createSecurityParameters(e, n)),
				(e.open = !0),
				k.queue(
					e,
					k.createRecord(e, {
						type: k.ContentType.handshake,
						data: k.createServerHello(e),
					}),
				),
				e.session.resuming
					? (k.queue(
							e,
							k.createRecord(e, {
								type: k.ContentType.change_cipher_spec,
								data: k.createChangeCipherSpec(),
							}),
						),
						(e.state.pending = k.createConnectionState(e)),
						(e.state.current.write = e.state.pending.write),
						k.queue(
							e,
							k.createRecord(e, {
								type: k.ContentType.handshake,
								data: k.createFinished(e),
							}),
						))
					: (k.queue(
							e,
							k.createRecord(e, {
								type: k.ContentType.handshake,
								data: k.createCertificate(e),
							}),
						),
						e.fail ||
							(k.queue(
								e,
								k.createRecord(e, {
									type: k.ContentType.handshake,
									data: k.createServerKeyExchange(e),
								}),
							),
							e.verifyClient !== !1 &&
								k.queue(
									e,
									k.createRecord(e, {
										type: k.ContentType.handshake,
										data: k.createCertificateRequest(e),
									}),
								),
							k.queue(
								e,
								k.createRecord(e, {
									type: k.ContentType.handshake,
									data: k.createServerHelloDone(e),
								}),
							))),
				k.flush(e),
				e.process()
		}
	}
	k.handleCertificate = function (e, t, r) {
		if (r < 3)
			return e.error(e, {
				message: "Invalid Certificate message. Message too short.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.illegal_parameter,
				},
			})
		var n = t.fragment,
			i = { certificate_list: ba(n, 3) },
			s,
			o,
			a = []
		try {
			for (; i.certificate_list.length() > 0; )
				(s = ba(i.certificate_list, 3)),
					(o = pe.asn1.fromDer(s)),
					(s = pe.pki.certificateFromAsn1(o, !0)),
					a.push(s)
		} catch (c) {
			return e.error(e, {
				message: "Could not parse certificate list.",
				cause: c,
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.bad_certificate,
				},
			})
		}
		var l = e.entity === k.ConnectionEnd.client
		;(l || e.verifyClient === !0) && a.length === 0
			? e.error(e, {
					message: l ? "No server certificate provided." : "No client certificate provided.",
					send: !0,
					alert: {
						level: k.Alert.Level.fatal,
						description: k.Alert.Description.illegal_parameter,
					},
				})
			: a.length === 0
				? (e.expect = l ? yce : V5)
				: (l ? (e.session.serverCertificate = a[0]) : (e.session.clientCertificate = a[0]),
					k.verifyCertificateChain(e, a) && (e.expect = l ? yce : V5)),
			e.process()
	}
	k.handleServerKeyExchange = function (e, t, r) {
		if (r > 0)
			return e.error(e, {
				message: "Invalid key parameters. Only RSA is supported.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.unsupported_certificate,
				},
			})
		;(e.expect = xXe), e.process()
	}
	k.handleClientKeyExchange = function (e, t, r) {
		if (r < 48)
			return e.error(e, {
				message: "Invalid key parameters. Only RSA is supported.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.unsupported_certificate,
				},
			})
		var n = t.fragment,
			i = { enc_pre_master_secret: ba(n, 2).getBytes() },
			s = null
		if (e.getPrivateKey)
			try {
				;(s = e.getPrivateKey(e, e.session.serverCertificate)), (s = pe.pki.privateKeyFromPem(s))
			} catch (l) {
				e.error(e, {
					message: "Could not get private key.",
					cause: l,
					send: !0,
					alert: {
						level: k.Alert.Level.fatal,
						description: k.Alert.Description.internal_error,
					},
				})
			}
		if (s === null)
			return e.error(e, {
				message: "No private key set.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.internal_error,
				},
			})
		try {
			var o = e.session.sp
			o.pre_master_secret = s.decrypt(i.enc_pre_master_secret)
			var a = e.session.clientHelloVersion
			if (a.major !== o.pre_master_secret.charCodeAt(0) || a.minor !== o.pre_master_secret.charCodeAt(1))
				throw new Error("TLS version rollback attack detected.")
		} catch {
			o.pre_master_secret = pe.random.getBytes(48)
		}
		;(e.expect = H5), e.session.clientCertificate !== null && (e.expect = TXe), e.process()
	}
	k.handleCertificateRequest = function (e, t, r) {
		if (r < 3)
			return e.error(e, {
				message: "Invalid CertificateRequest. Message too short.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.illegal_parameter,
				},
			})
		var n = t.fragment,
			i = { certificate_types: ba(n, 1), certificate_authorities: ba(n, 2) }
		;(e.session.certificateRequest = i), (e.expect = _Xe), e.process()
	}
	k.handleCertificateVerify = function (e, t, r) {
		if (r < 2)
			return e.error(e, {
				message: "Invalid CertificateVerify. Message too short.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.illegal_parameter,
				},
			})
		var n = t.fragment
		n.read -= 4
		var i = n.bytes()
		n.read += 4
		var s = { signature: ba(n, 2).getBytes() },
			o = pe.util.createBuffer()
		o.putBuffer(e.session.md5.digest()), o.putBuffer(e.session.sha1.digest()), (o = o.getBytes())
		try {
			var a = e.session.clientCertificate
			if (!a.publicKey.verify(o, s.signature, "NONE"))
				throw new Error("CertificateVerify signature does not match.")
			e.session.md5.update(i), e.session.sha1.update(i)
		} catch {
			return e.error(e, {
				message: "Bad signature in CertificateVerify.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.handshake_failure,
				},
			})
		}
		;(e.expect = H5), e.process()
	}
	k.handleServerHelloDone = function (e, t, r) {
		if (r > 0)
			return e.error(e, {
				message: "Invalid ServerHelloDone message. Invalid length.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.record_overflow,
				},
			})
		if (e.serverCertificate === null) {
			var n = {
					message: "No server certificate provided. Not enough security.",
					send: !0,
					alert: {
						level: k.Alert.Level.fatal,
						description: k.Alert.Description.insufficient_security,
					},
				},
				i = 0,
				s = e.verify(e, n.alert.description, i, [])
			if (s !== !0)
				return (
					(s || s === 0) &&
						(typeof s == "object" && !pe.util.isArray(s)
							? (s.message && (n.message = s.message), s.alert && (n.alert.description = s.alert))
							: typeof s == "number" && (n.alert.description = s)),
					e.error(e, n)
				)
		}
		e.session.certificateRequest !== null &&
			((t = k.createRecord(e, {
				type: k.ContentType.handshake,
				data: k.createCertificate(e),
			})),
			k.queue(e, t)),
			(t = k.createRecord(e, {
				type: k.ContentType.handshake,
				data: k.createClientKeyExchange(e),
			})),
			k.queue(e, t),
			(e.expect = SXe)
		var o = function (a, l) {
			a.session.certificateRequest !== null &&
				a.session.clientCertificate !== null &&
				k.queue(
					a,
					k.createRecord(a, {
						type: k.ContentType.handshake,
						data: k.createCertificateVerify(a, l),
					}),
				),
				k.queue(
					a,
					k.createRecord(a, {
						type: k.ContentType.change_cipher_spec,
						data: k.createChangeCipherSpec(),
					}),
				),
				(a.state.pending = k.createConnectionState(a)),
				(a.state.current.write = a.state.pending.write),
				k.queue(
					a,
					k.createRecord(a, {
						type: k.ContentType.handshake,
						data: k.createFinished(a),
					}),
				),
				(a.expect = vce),
				k.flush(a),
				a.process()
		}
		if (e.session.certificateRequest === null || e.session.clientCertificate === null) return o(e, null)
		k.getClientSignature(e, o)
	}
	k.handleChangeCipherSpec = function (e, t) {
		if (t.fragment.getByte() !== 1)
			return e.error(e, {
				message: "Invalid ChangeCipherSpec message received.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.illegal_parameter,
				},
			})
		var r = e.entity === k.ConnectionEnd.client
		;((e.session.resuming && r) || (!e.session.resuming && !r)) && (e.state.pending = k.createConnectionState(e)),
			(e.state.current.read = e.state.pending.read),
			((!e.session.resuming && r) || (e.session.resuming && !r)) && (e.state.pending = null),
			(e.expect = r ? wXe : RXe),
			e.process()
	}
	k.handleFinished = function (e, t, r) {
		var n = t.fragment
		n.read -= 4
		var i = n.bytes()
		n.read += 4
		var s = t.fragment.getBytes()
		;(n = pe.util.createBuffer()), n.putBuffer(e.session.md5.digest()), n.putBuffer(e.session.sha1.digest())
		var o = e.entity === k.ConnectionEnd.client,
			a = o ? "server finished" : "client finished",
			l = e.session.sp,
			c = 12,
			u = ST
		if (((n = u(l.master_secret, a, n.getBytes(), c)), n.getBytes() !== s))
			return e.error(e, {
				message: "Invalid verify_data in Finished message.",
				send: !0,
				alert: {
					level: k.Alert.Level.fatal,
					description: k.Alert.Description.decrypt_error,
				},
			})
		e.session.md5.update(i),
			e.session.sha1.update(i),
			((e.session.resuming && o) || (!e.session.resuming && !o)) &&
				(k.queue(
					e,
					k.createRecord(e, {
						type: k.ContentType.change_cipher_spec,
						data: k.createChangeCipherSpec(),
					}),
				),
				(e.state.current.write = e.state.pending.write),
				(e.state.pending = null),
				k.queue(
					e,
					k.createRecord(e, {
						type: k.ContentType.handshake,
						data: k.createFinished(e),
					}),
				)),
			(e.expect = o ? IXe : kXe),
			(e.handshaking = !1),
			++e.handshakes,
			(e.peerCertificate = o ? e.session.serverCertificate : e.session.clientCertificate),
			k.flush(e),
			(e.isConnected = !0),
			e.connected(e),
			e.process()
	}
	k.handleAlert = function (e, t) {
		var r = t.fragment,
			n = { level: r.getByte(), description: r.getByte() },
			i
		switch (n.description) {
			case k.Alert.Description.close_notify:
				i = "Connection closed."
				break
			case k.Alert.Description.unexpected_message:
				i = "Unexpected message."
				break
			case k.Alert.Description.bad_record_mac:
				i = "Bad record MAC."
				break
			case k.Alert.Description.decryption_failed:
				i = "Decryption failed."
				break
			case k.Alert.Description.record_overflow:
				i = "Record overflow."
				break
			case k.Alert.Description.decompression_failure:
				i = "Decompression failed."
				break
			case k.Alert.Description.handshake_failure:
				i = "Handshake failure."
				break
			case k.Alert.Description.bad_certificate:
				i = "Bad certificate."
				break
			case k.Alert.Description.unsupported_certificate:
				i = "Unsupported certificate."
				break
			case k.Alert.Description.certificate_revoked:
				i = "Certificate revoked."
				break
			case k.Alert.Description.certificate_expired:
				i = "Certificate expired."
				break
			case k.Alert.Description.certificate_unknown:
				i = "Certificate unknown."
				break
			case k.Alert.Description.illegal_parameter:
				i = "Illegal parameter."
				break
			case k.Alert.Description.unknown_ca:
				i = "Unknown certificate authority."
				break
			case k.Alert.Description.access_denied:
				i = "Access denied."
				break
			case k.Alert.Description.decode_error:
				i = "Decode error."
				break
			case k.Alert.Description.decrypt_error:
				i = "Decrypt error."
				break
			case k.Alert.Description.export_restriction:
				i = "Export restriction."
				break
			case k.Alert.Description.protocol_version:
				i = "Unsupported protocol version."
				break
			case k.Alert.Description.insufficient_security:
				i = "Insufficient security."
				break
			case k.Alert.Description.internal_error:
				i = "Internal error."
				break
			case k.Alert.Description.user_canceled:
				i = "User canceled."
				break
			case k.Alert.Description.no_renegotiation:
				i = "Renegotiation not supported."
				break
			default:
				i = "Unknown error."
				break
		}
		if (n.description === k.Alert.Description.close_notify) return e.close()
		e.error(e, {
			message: i,
			send: !1,
			origin: e.entity === k.ConnectionEnd.client ? "server" : "client",
			alert: n,
		}),
			e.process()
	}
	k.handleHandshake = function (e, t) {
		var r = t.fragment,
			n = r.getByte(),
			i = r.getInt24()
		if (i > r.length()) return (e.fragmented = t), (t.fragment = pe.util.createBuffer()), (r.read -= 4), e.process()
		;(e.fragmented = null), (r.read -= 4)
		var s = r.bytes(i + 4)
		;(r.read += 4),
			n in IT[e.entity][e.expect]
				? (e.entity === k.ConnectionEnd.server &&
						!e.open &&
						!e.fail &&
						((e.handshaking = !0),
						(e.session = {
							version: null,
							extensions: { server_name: { serverNameList: [] } },
							cipherSuite: null,
							compressionMethod: null,
							serverCertificate: null,
							clientCertificate: null,
							md5: pe.md.md5.create(),
							sha1: pe.md.sha1.create(),
						})),
					n !== k.HandshakeType.hello_request &&
						n !== k.HandshakeType.certificate_verify &&
						n !== k.HandshakeType.finished &&
						(e.session.md5.update(s), e.session.sha1.update(s)),
					IT[e.entity][e.expect][n](e, t, i))
				: k.handleUnexpected(e, t)
	}
	k.handleApplicationData = function (e, t) {
		e.data.putBuffer(t.fragment), e.dataReady(e), e.process()
	}
	k.handleHeartbeat = function (e, t) {
		var r = t.fragment,
			n = r.getByte(),
			i = r.getInt16(),
			s = r.getBytes(i)
		if (n === k.HeartbeatMessageType.heartbeat_request) {
			if (e.handshaking || i > s.length) return e.process()
			k.queue(
				e,
				k.createRecord(e, {
					type: k.ContentType.heartbeat,
					data: k.createHeartbeat(k.HeartbeatMessageType.heartbeat_response, s),
				}),
			),
				k.flush(e)
		} else if (n === k.HeartbeatMessageType.heartbeat_response) {
			if (s !== e.expectedHeartbeatPayload) return e.process()
			e.heartbeatReceived && e.heartbeatReceived(e, pe.util.createBuffer(s))
		}
		e.process()
	}
	var EXe = 0,
		bXe = 1,
		yce = 2,
		xXe = 3,
		_Xe = 4,
		vce = 5,
		wXe = 6,
		IXe = 7,
		SXe = 8,
		BXe = 0,
		DXe = 1,
		V5 = 2,
		TXe = 3,
		H5 = 4,
		RXe = 5,
		kXe = 6,
		T = k.handleUnexpected,
		Ece = k.handleChangeCipherSpec,
		Cs = k.handleAlert,
		ao = k.handleHandshake,
		bce = k.handleApplicationData,
		vs = k.handleHeartbeat,
		W5 = []
	W5[k.ConnectionEnd.client] = [
		[T, Cs, ao, T, vs],
		[T, Cs, ao, T, vs],
		[T, Cs, ao, T, vs],
		[T, Cs, ao, T, vs],
		[T, Cs, ao, T, vs],
		[Ece, Cs, T, T, vs],
		[T, Cs, ao, T, vs],
		[T, Cs, ao, bce, vs],
		[T, Cs, ao, T, vs],
	]
	W5[k.ConnectionEnd.server] = [
		[T, Cs, ao, T, vs],
		[T, Cs, ao, T, vs],
		[T, Cs, ao, T, vs],
		[T, Cs, ao, T, vs],
		[Ece, Cs, T, T, vs],
		[T, Cs, ao, T, vs],
		[T, Cs, ao, bce, vs],
		[T, Cs, ao, T, vs],
	]
	var Ah = k.handleHelloRequest,
		MXe = k.handleServerHello,
		xce = k.handleCertificate,
		Cce = k.handleServerKeyExchange,
		O5 = k.handleCertificateRequest,
		_T = k.handleServerHelloDone,
		_ce = k.handleFinished,
		IT = []
	IT[k.ConnectionEnd.client] = [
		[T, T, MXe, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
		[Ah, T, T, T, T, T, T, T, T, T, T, xce, Cce, O5, _T, T, T, T, T, T, T],
		[Ah, T, T, T, T, T, T, T, T, T, T, T, Cce, O5, _T, T, T, T, T, T, T],
		[Ah, T, T, T, T, T, T, T, T, T, T, T, T, O5, _T, T, T, T, T, T, T],
		[Ah, T, T, T, T, T, T, T, T, T, T, T, T, T, _T, T, T, T, T, T, T],
		[Ah, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
		[Ah, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, _ce],
		[Ah, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
		[Ah, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
	]
	var FXe = k.handleClientHello,
		QXe = k.handleClientKeyExchange,
		NXe = k.handleCertificateVerify
	IT[k.ConnectionEnd.server] = [
		[T, FXe, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
		[T, T, T, T, T, T, T, T, T, T, T, xce, T, T, T, T, T, T, T, T, T],
		[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, QXe, T, T, T, T],
		[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, NXe, T, T, T, T, T],
		[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
		[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, _ce],
		[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
		[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
	]
	k.generateKeys = function (e, t) {
		var r = ST,
			n = t.client_random + t.server_random
		e.session.resuming ||
			((t.master_secret = r(t.pre_master_secret, "master secret", n, 48).bytes()), (t.pre_master_secret = null)),
			(n = t.server_random + t.client_random)
		var i = 2 * t.mac_key_length + 2 * t.enc_key_length,
			s = e.version.major === k.Versions.TLS_1_0.major && e.version.minor === k.Versions.TLS_1_0.minor
		s && (i += 2 * t.fixed_iv_length)
		var o = r(t.master_secret, "key expansion", n, i),
			a = {
				client_write_MAC_key: o.getBytes(t.mac_key_length),
				server_write_MAC_key: o.getBytes(t.mac_key_length),
				client_write_key: o.getBytes(t.enc_key_length),
				server_write_key: o.getBytes(t.enc_key_length),
			}
		return (
			s &&
				((a.client_write_IV = o.getBytes(t.fixed_iv_length)),
				(a.server_write_IV = o.getBytes(t.fixed_iv_length))),
			a
		)
	}
	k.createConnectionState = function (e) {
		var t = e.entity === k.ConnectionEnd.client,
			r = function () {
				var s = {
					sequenceNumber: [0, 0],
					macKey: null,
					macLength: 0,
					macFunction: null,
					cipherState: null,
					cipherFunction: function (o) {
						return !0
					},
					compressionState: null,
					compressFunction: function (o) {
						return !0
					},
					updateSequenceNumber: function () {
						s.sequenceNumber[1] === 4294967295
							? ((s.sequenceNumber[1] = 0), ++s.sequenceNumber[0])
							: ++s.sequenceNumber[1]
					},
				}
				return s
			},
			n = { read: r(), write: r() }
		if (
			((n.read.update = function (s, o) {
				return (
					n.read.cipherFunction(o, n.read)
						? n.read.compressFunction(s, o, n.read) ||
							s.error(s, {
								message: "Could not decompress record.",
								send: !0,
								alert: {
									level: k.Alert.Level.fatal,
									description: k.Alert.Description.decompression_failure,
								},
							})
						: s.error(s, {
								message: "Could not decrypt record or bad MAC.",
								send: !0,
								alert: {
									level: k.Alert.Level.fatal,
									description: k.Alert.Description.bad_record_mac,
								},
							}),
					!s.fail
				)
			}),
			(n.write.update = function (s, o) {
				return (
					n.write.compressFunction(s, o, n.write)
						? n.write.cipherFunction(o, n.write) ||
							s.error(s, {
								message: "Could not encrypt record.",
								send: !1,
								alert: {
									level: k.Alert.Level.fatal,
									description: k.Alert.Description.internal_error,
								},
							})
						: s.error(s, {
								message: "Could not compress record.",
								send: !1,
								alert: {
									level: k.Alert.Level.fatal,
									description: k.Alert.Description.internal_error,
								},
							}),
					!s.fail
				)
			}),
			e.session)
		) {
			var i = e.session.sp
			switch (
				(e.session.cipherSuite.initSecurityParameters(i),
				(i.keys = k.generateKeys(e, i)),
				(n.read.macKey = t ? i.keys.server_write_MAC_key : i.keys.client_write_MAC_key),
				(n.write.macKey = t ? i.keys.client_write_MAC_key : i.keys.server_write_MAC_key),
				e.session.cipherSuite.initConnectionState(n, e, i),
				i.compression_algorithm)
			) {
				case k.CompressionMethod.none:
					break
				case k.CompressionMethod.deflate:
					;(n.read.compressFunction = vXe), (n.write.compressFunction = CXe)
					break
				default:
					throw new Error("Unsupported compression algorithm.")
			}
		}
		return n
	}
	k.createRandom = function () {
		var e = new Date(),
			t = +e + e.getTimezoneOffset() * 6e4,
			r = pe.util.createBuffer()
		return r.putInt32(t), r.putBytes(pe.random.getBytes(28)), r
	}
	k.createRecord = function (e, t) {
		if (!t.data) return null
		var r = {
			type: t.type,
			version: { major: e.version.major, minor: e.version.minor },
			length: t.data.length(),
			fragment: t.data,
		}
		return r
	}
	k.createAlert = function (e, t) {
		var r = pe.util.createBuffer()
		return r.putByte(t.level), r.putByte(t.description), k.createRecord(e, { type: k.ContentType.alert, data: r })
	}
	k.createClientHello = function (e) {
		e.session.clientHelloVersion = {
			major: e.version.major,
			minor: e.version.minor,
		}
		for (var t = pe.util.createBuffer(), r = 0; r < e.cipherSuites.length; ++r) {
			var n = e.cipherSuites[r]
			t.putByte(n.id[0]), t.putByte(n.id[1])
		}
		var i = t.length(),
			s = pe.util.createBuffer()
		s.putByte(k.CompressionMethod.none)
		var o = s.length(),
			a = pe.util.createBuffer()
		if (e.virtualHost) {
			var l = pe.util.createBuffer()
			l.putByte(0), l.putByte(0)
			var c = pe.util.createBuffer()
			c.putByte(0), hl(c, 2, pe.util.createBuffer(e.virtualHost))
			var u = pe.util.createBuffer()
			hl(u, 2, c), hl(l, 2, u), a.putBuffer(l)
		}
		var f = a.length()
		f > 0 && (f += 2)
		var p = e.session.id,
			g = p.length + 1 + 2 + 4 + 28 + 2 + i + 1 + o + f,
			m = pe.util.createBuffer()
		return (
			m.putByte(k.HandshakeType.client_hello),
			m.putInt24(g),
			m.putByte(e.version.major),
			m.putByte(e.version.minor),
			m.putBytes(e.session.sp.client_random),
			hl(m, 1, pe.util.createBuffer(p)),
			hl(m, 2, t),
			hl(m, 1, s),
			f > 0 && hl(m, 2, a),
			m
		)
	}
	k.createServerHello = function (e) {
		var t = e.session.id,
			r = t.length + 1 + 2 + 4 + 28 + 2 + 1,
			n = pe.util.createBuffer()
		return (
			n.putByte(k.HandshakeType.server_hello),
			n.putInt24(r),
			n.putByte(e.version.major),
			n.putByte(e.version.minor),
			n.putBytes(e.session.sp.server_random),
			hl(n, 1, pe.util.createBuffer(t)),
			n.putByte(e.session.cipherSuite.id[0]),
			n.putByte(e.session.cipherSuite.id[1]),
			n.putByte(e.session.compressionMethod),
			n
		)
	}
	k.createCertificate = function (e) {
		var t = e.entity === k.ConnectionEnd.client,
			r = null
		if (e.getCertificate) {
			var n
			t ? (n = e.session.certificateRequest) : (n = e.session.extensions.server_name.serverNameList),
				(r = e.getCertificate(e, n))
		}
		var i = pe.util.createBuffer()
		if (r !== null)
			try {
				pe.util.isArray(r) || (r = [r])
				for (var s = null, o = 0; o < r.length; ++o) {
					var a = pe.pem.decode(r[o])[0]
					if (a.type !== "CERTIFICATE" && a.type !== "X509 CERTIFICATE" && a.type !== "TRUSTED CERTIFICATE") {
						var l = new Error(
							'Could not convert certificate from PEM; PEM header type is not "CERTIFICATE", "X509 CERTIFICATE", or "TRUSTED CERTIFICATE".',
						)
						throw ((l.headerType = a.type), l)
					}
					if (a.procType && a.procType.type === "ENCRYPTED")
						throw new Error("Could not convert certificate from PEM; PEM is encrypted.")
					var c = pe.util.createBuffer(a.body)
					s === null && (s = pe.asn1.fromDer(c.bytes(), !1))
					var u = pe.util.createBuffer()
					hl(u, 3, c), i.putBuffer(u)
				}
				;(r = pe.pki.certificateFromAsn1(s)),
					t ? (e.session.clientCertificate = r) : (e.session.serverCertificate = r)
			} catch (g) {
				return e.error(e, {
					message: "Could not send certificate list.",
					cause: g,
					send: !0,
					alert: {
						level: k.Alert.Level.fatal,
						description: k.Alert.Description.bad_certificate,
					},
				})
			}
		var f = 3 + i.length(),
			p = pe.util.createBuffer()
		return p.putByte(k.HandshakeType.certificate), p.putInt24(f), hl(p, 3, i), p
	}
	k.createClientKeyExchange = function (e) {
		var t = pe.util.createBuffer()
		t.putByte(e.session.clientHelloVersion.major),
			t.putByte(e.session.clientHelloVersion.minor),
			t.putBytes(pe.random.getBytes(46))
		var r = e.session.sp
		r.pre_master_secret = t.getBytes()
		var n = e.session.serverCertificate.publicKey
		t = n.encrypt(r.pre_master_secret)
		var i = t.length + 2,
			s = pe.util.createBuffer()
		return s.putByte(k.HandshakeType.client_key_exchange), s.putInt24(i), s.putInt16(t.length), s.putBytes(t), s
	}
	k.createServerKeyExchange = function (e) {
		var t = 0,
			r = pe.util.createBuffer()
		return t > 0 && (r.putByte(k.HandshakeType.server_key_exchange), r.putInt24(t)), r
	}
	k.getClientSignature = function (e, t) {
		var r = pe.util.createBuffer()
		r.putBuffer(e.session.md5.digest()),
			r.putBuffer(e.session.sha1.digest()),
			(r = r.getBytes()),
			(e.getSignature =
				e.getSignature ||
				function (n, i, s) {
					var o = null
					if (n.getPrivateKey)
						try {
							;(o = n.getPrivateKey(n, n.session.clientCertificate)), (o = pe.pki.privateKeyFromPem(o))
						} catch (a) {
							n.error(n, {
								message: "Could not get private key.",
								cause: a,
								send: !0,
								alert: {
									level: k.Alert.Level.fatal,
									description: k.Alert.Description.internal_error,
								},
							})
						}
					o === null
						? n.error(n, {
								message: "No private key set.",
								send: !0,
								alert: {
									level: k.Alert.Level.fatal,
									description: k.Alert.Description.internal_error,
								},
							})
						: (i = o.sign(i, null)),
						s(n, i)
				}),
			e.getSignature(e, r, t)
	}
	k.createCertificateVerify = function (e, t) {
		var r = t.length + 2,
			n = pe.util.createBuffer()
		return n.putByte(k.HandshakeType.certificate_verify), n.putInt24(r), n.putInt16(t.length), n.putBytes(t), n
	}
	k.createCertificateRequest = function (e) {
		var t = pe.util.createBuffer()
		t.putByte(1)
		var r = pe.util.createBuffer()
		for (var n in e.caStore.certs) {
			var i = e.caStore.certs[n],
				s = pe.pki.distinguishedNameToAsn1(i.subject),
				o = pe.asn1.toDer(s)
			r.putInt16(o.length()), r.putBuffer(o)
		}
		var a = 1 + t.length() + 2 + r.length(),
			l = pe.util.createBuffer()
		return l.putByte(k.HandshakeType.certificate_request), l.putInt24(a), hl(l, 1, t), hl(l, 2, r), l
	}
	k.createServerHelloDone = function (e) {
		var t = pe.util.createBuffer()
		return t.putByte(k.HandshakeType.server_hello_done), t.putInt24(0), t
	}
	k.createChangeCipherSpec = function () {
		var e = pe.util.createBuffer()
		return e.putByte(1), e
	}
	k.createFinished = function (e) {
		var t = pe.util.createBuffer()
		t.putBuffer(e.session.md5.digest()), t.putBuffer(e.session.sha1.digest())
		var r = e.entity === k.ConnectionEnd.client,
			n = e.session.sp,
			i = 12,
			s = ST,
			o = r ? "client finished" : "server finished"
		t = s(n.master_secret, o, t.getBytes(), i)
		var a = pe.util.createBuffer()
		return a.putByte(k.HandshakeType.finished), a.putInt24(t.length()), a.putBuffer(t), a
	}
	k.createHeartbeat = function (e, t, r) {
		typeof r > "u" && (r = t.length)
		var n = pe.util.createBuffer()
		n.putByte(e), n.putInt16(r), n.putBytes(t)
		var i = n.length(),
			s = Math.max(16, i - r - 3)
		return n.putBytes(pe.random.getBytes(s)), n
	}
	k.queue = function (e, t) {
		if (
			t &&
			!(
				t.fragment.length() === 0 &&
				(t.type === k.ContentType.handshake ||
					t.type === k.ContentType.alert ||
					t.type === k.ContentType.change_cipher_spec)
			)
		) {
			if (t.type === k.ContentType.handshake) {
				var r = t.fragment.bytes()
				e.session.md5.update(r), e.session.sha1.update(r), (r = null)
			}
			var n
			if (t.fragment.length() <= k.MaxFragment) n = [t]
			else {
				n = []
				for (var i = t.fragment.bytes(); i.length > k.MaxFragment; )
					n.push(
						k.createRecord(e, {
							type: t.type,
							data: pe.util.createBuffer(i.slice(0, k.MaxFragment)),
						}),
					),
						(i = i.slice(k.MaxFragment))
				i.length > 0 && n.push(k.createRecord(e, { type: t.type, data: pe.util.createBuffer(i) }))
			}
			for (var s = 0; s < n.length && !e.fail; ++s) {
				var o = n[s],
					a = e.state.current.write
				a.update(e, o) && e.records.push(o)
			}
		}
	}
	k.flush = function (e) {
		for (var t = 0; t < e.records.length; ++t) {
			var r = e.records[t]
			e.tlsData.putByte(r.type),
				e.tlsData.putByte(r.version.major),
				e.tlsData.putByte(r.version.minor),
				e.tlsData.putInt16(r.fragment.length()),
				e.tlsData.putBuffer(e.records[t].fragment)
		}
		return (e.records = []), e.tlsDataReady(e)
	}
	var q5 = function (e) {
			switch (e) {
				case !0:
					return !0
				case pe.pki.certificateError.bad_certificate:
					return k.Alert.Description.bad_certificate
				case pe.pki.certificateError.unsupported_certificate:
					return k.Alert.Description.unsupported_certificate
				case pe.pki.certificateError.certificate_revoked:
					return k.Alert.Description.certificate_revoked
				case pe.pki.certificateError.certificate_expired:
					return k.Alert.Description.certificate_expired
				case pe.pki.certificateError.certificate_unknown:
					return k.Alert.Description.certificate_unknown
				case pe.pki.certificateError.unknown_ca:
					return k.Alert.Description.unknown_ca
				default:
					return k.Alert.Description.bad_certificate
			}
		},
		PXe = function (e) {
			switch (e) {
				case !0:
					return !0
				case k.Alert.Description.bad_certificate:
					return pe.pki.certificateError.bad_certificate
				case k.Alert.Description.unsupported_certificate:
					return pe.pki.certificateError.unsupported_certificate
				case k.Alert.Description.certificate_revoked:
					return pe.pki.certificateError.certificate_revoked
				case k.Alert.Description.certificate_expired:
					return pe.pki.certificateError.certificate_expired
				case k.Alert.Description.certificate_unknown:
					return pe.pki.certificateError.certificate_unknown
				case k.Alert.Description.unknown_ca:
					return pe.pki.certificateError.unknown_ca
				default:
					return pe.pki.certificateError.bad_certificate
			}
		}
	k.verifyCertificateChain = function (e, t) {
		try {
			var r = {}
			for (var n in e.verifyOptions) r[n] = e.verifyOptions[n]
			;(r.verify = function (s, o, a) {
				var l = q5(s),
					c = e.verify(e, s, o, a)
				if (c !== !0) {
					if (typeof c == "object" && !pe.util.isArray(c)) {
						var u = new Error("The application rejected the certificate.")
						throw (
							((u.send = !0),
							(u.alert = {
								level: k.Alert.Level.fatal,
								description: k.Alert.Description.bad_certificate,
							}),
							c.message && (u.message = c.message),
							c.alert && (u.alert.description = c.alert),
							u)
						)
					}
					c !== s && (c = PXe(c))
				}
				return c
			}),
				pe.pki.verifyCertificateChain(e.caStore, t, r)
		} catch (s) {
			var i = s
			;(typeof i != "object" || pe.util.isArray(i)) &&
				(i = {
					send: !0,
					alert: { level: k.Alert.Level.fatal, description: q5(s) },
				}),
				"send" in i || (i.send = !0),
				"alert" in i || (i.alert = { level: k.Alert.Level.fatal, description: q5(i.error) }),
				e.error(e, i)
		}
		return !e.fail
	}
	k.createSessionCache = function (e, t) {
		var r = null
		if (e && e.getSession && e.setSession && e.order) r = e
		else {
			;(r = {}), (r.cache = e || {}), (r.capacity = Math.max(t || 100, 1)), (r.order = [])
			for (var n in e) r.order.length <= t ? r.order.push(n) : delete e[n]
			;(r.getSession = function (i) {
				var s = null,
					o = null
				if (
					(i ? (o = pe.util.bytesToHex(i)) : r.order.length > 0 && (o = r.order[0]),
					o !== null && o in r.cache)
				) {
					;(s = r.cache[o]), delete r.cache[o]
					for (var a in r.order)
						if (r.order[a] === o) {
							r.order.splice(a, 1)
							break
						}
				}
				return s
			}),
				(r.setSession = function (i, s) {
					if (r.order.length === r.capacity) {
						var o = r.order.shift()
						delete r.cache[o]
					}
					var o = pe.util.bytesToHex(i)
					r.order.push(o), (r.cache[o] = s)
				})
		}
		return r
	}
	k.createConnection = function (e) {
		var t = null
		e.caStore
			? pe.util.isArray(e.caStore)
				? (t = pe.pki.createCaStore(e.caStore))
				: (t = e.caStore)
			: (t = pe.pki.createCaStore())
		var r = e.cipherSuites || null
		if (r === null) {
			r = []
			for (var n in k.CipherSuites) r.push(k.CipherSuites[n])
		}
		var i = e.server ? k.ConnectionEnd.server : k.ConnectionEnd.client,
			s = e.sessionCache ? k.createSessionCache(e.sessionCache) : null,
			o = {
				version: { major: k.Version.major, minor: k.Version.minor },
				entity: i,
				sessionId: e.sessionId,
				caStore: t,
				sessionCache: s,
				cipherSuites: r,
				connected: e.connected,
				virtualHost: e.virtualHost || null,
				verifyClient: e.verifyClient || !1,
				verify:
					e.verify ||
					function (u, f, p, g) {
						return f
					},
				verifyOptions: e.verifyOptions || {},
				getCertificate: e.getCertificate || null,
				getPrivateKey: e.getPrivateKey || null,
				getSignature: e.getSignature || null,
				input: pe.util.createBuffer(),
				tlsData: pe.util.createBuffer(),
				data: pe.util.createBuffer(),
				tlsDataReady: e.tlsDataReady,
				dataReady: e.dataReady,
				heartbeatReceived: e.heartbeatReceived,
				closed: e.closed,
				error: function (u, f) {
					;(f.origin = f.origin || (u.entity === k.ConnectionEnd.client ? "client" : "server")),
						f.send && (k.queue(u, k.createAlert(u, f.alert)), k.flush(u))
					var p = f.fatal !== !1
					p && (u.fail = !0), e.error(u, f), p && u.close(!1)
				},
				deflate: e.deflate || null,
				inflate: e.inflate || null,
			}
		;(o.reset = function (u) {
			;(o.version = { major: k.Version.major, minor: k.Version.minor }),
				(o.record = null),
				(o.session = null),
				(o.peerCertificate = null),
				(o.state = { pending: null, current: null }),
				(o.expect = o.entity === k.ConnectionEnd.client ? EXe : BXe),
				(o.fragmented = null),
				(o.records = []),
				(o.open = !1),
				(o.handshakes = 0),
				(o.handshaking = !1),
				(o.isConnected = !1),
				(o.fail = !(u || typeof u > "u")),
				o.input.clear(),
				o.tlsData.clear(),
				o.data.clear(),
				(o.state.current = k.createConnectionState(o))
		}),
			o.reset()
		var a = function (u, f) {
				var p = f.type - k.ContentType.change_cipher_spec,
					g = W5[u.entity][u.expect]
				p in g ? g[p](u, f) : k.handleUnexpected(u, f)
			},
			l = function (u) {
				var f = 0,
					p = u.input,
					g = p.length()
				if (g < 5) f = 5 - g
				else {
					u.record = {
						type: p.getByte(),
						version: { major: p.getByte(), minor: p.getByte() },
						length: p.getInt16(),
						fragment: pe.util.createBuffer(),
						ready: !1,
					}
					var m = u.record.version.major === u.version.major
					m && u.session && u.session.version && (m = u.record.version.minor === u.version.minor),
						m ||
							u.error(u, {
								message: "Incompatible TLS version.",
								send: !0,
								alert: {
									level: k.Alert.Level.fatal,
									description: k.Alert.Description.protocol_version,
								},
							})
				}
				return f
			},
			c = function (u) {
				var f = 0,
					p = u.input,
					g = p.length()
				if (g < u.record.length) f = u.record.length - g
				else {
					u.record.fragment.putBytes(p.getBytes(u.record.length)), p.compact()
					var m = u.state.current.read
					m.update(u, u.record) &&
						(u.fragmented !== null &&
							(u.fragmented.type === u.record.type
								? (u.fragmented.fragment.putBuffer(u.record.fragment), (u.record = u.fragmented))
								: u.error(u, {
										message: "Invalid fragmented record.",
										send: !0,
										alert: {
											level: k.Alert.Level.fatal,
											description: k.Alert.Description.unexpected_message,
										},
									})),
						(u.record.ready = !0))
				}
				return f
			}
		return (
			(o.handshake = function (u) {
				if (o.entity !== k.ConnectionEnd.client)
					o.error(o, {
						message: "Cannot initiate handshake as a server.",
						fatal: !1,
					})
				else if (o.handshaking) o.error(o, { message: "Handshake already in progress.", fatal: !1 })
				else {
					o.fail && !o.open && o.handshakes === 0 && (o.fail = !1), (o.handshaking = !0), (u = u || "")
					var f = null
					u.length > 0 && (o.sessionCache && (f = o.sessionCache.getSession(u)), f === null && (u = "")),
						u.length === 0 &&
							o.sessionCache &&
							((f = o.sessionCache.getSession()), f !== null && (u = f.id)),
						(o.session = {
							id: u,
							version: null,
							cipherSuite: null,
							compressionMethod: null,
							serverCertificate: null,
							certificateRequest: null,
							clientCertificate: null,
							sp: {},
							md5: pe.md.md5.create(),
							sha1: pe.md.sha1.create(),
						}),
						f && ((o.version = f.version), (o.session.sp = f.sp)),
						(o.session.sp.client_random = k.createRandom().getBytes()),
						(o.open = !0),
						k.queue(
							o,
							k.createRecord(o, {
								type: k.ContentType.handshake,
								data: k.createClientHello(o),
							}),
						),
						k.flush(o)
				}
			}),
			(o.process = function (u) {
				var f = 0
				return (
					u && o.input.putBytes(u),
					o.fail ||
						(o.record !== null && o.record.ready && o.record.fragment.isEmpty() && (o.record = null),
						o.record === null && (f = l(o)),
						!o.fail && o.record !== null && !o.record.ready && (f = c(o)),
						!o.fail && o.record !== null && o.record.ready && a(o, o.record)),
					f
				)
			}),
			(o.prepare = function (u) {
				return (
					k.queue(
						o,
						k.createRecord(o, {
							type: k.ContentType.application_data,
							data: pe.util.createBuffer(u),
						}),
					),
					k.flush(o)
				)
			}),
			(o.prepareHeartbeatRequest = function (u, f) {
				return (
					u instanceof pe.util.ByteBuffer && (u = u.bytes()),
					typeof f > "u" && (f = u.length),
					(o.expectedHeartbeatPayload = u),
					k.queue(
						o,
						k.createRecord(o, {
							type: k.ContentType.heartbeat,
							data: k.createHeartbeat(k.HeartbeatMessageType.heartbeat_request, u, f),
						}),
					),
					k.flush(o)
				)
			}),
			(o.close = function (u) {
				if (!o.fail && o.sessionCache && o.session) {
					var f = {
						id: o.session.id,
						version: o.session.version,
						sp: o.session.sp,
					}
					;(f.sp.keys = null), o.sessionCache.setSession(f.id, f)
				}
				o.open &&
					((o.open = !1),
					o.input.clear(),
					(o.isConnected || o.handshaking) &&
						((o.isConnected = o.handshaking = !1),
						k.queue(
							o,
							k.createAlert(o, {
								level: k.Alert.Level.warning,
								description: k.Alert.Description.close_notify,
							}),
						),
						k.flush(o)),
					o.closed(o)),
					o.reset(u)
			}),
			o
		)
	}
	wce.exports = pe.tls = pe.tls || {}
	for (wT in k) typeof k[wT] != "function" && (pe.tls[wT] = k[wT])
	var wT
	pe.tls.prf_tls1 = ST
	pe.tls.hmac_sha1 = yXe
	pe.tls.createSessionCache = k.createSessionCache
	pe.tls.createConnection = k.createConnection
})