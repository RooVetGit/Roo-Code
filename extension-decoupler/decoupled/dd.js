
	var {
			makeNetworkError: nn,
			makeAppropriateNetworkError: wD,
			filterResponse: RV,
			makeResponse: ID,
			fromInnerResponse: IYe,
		} = ab(),
		{ HeadersList: Lse } = pp(),
		{ Request: SYe, cloneRequest: BYe } = w0(),
		nh = require("zlib"),
		{
			bytesMatch: DYe,
			makePolicyContainer: TYe,
			clonePolicyContainer: RYe,
			requestBadPort: kYe,
			TAOCheck: MYe,
			appendRequestOriginHeader: FYe,
			responseLocationURL: QYe,
			requestCurrentURL: uu,
			setRequestReferrerPolicyOnRedirect: NYe,
			tryUpgradeRequestToAPotentiallyTrustworthyURL: PYe,
			createOpaqueTimingInfo: NV,
			appendFetchMetadata: LYe,
			corsCheck: UYe,
			crossOriginResourcePolicyCheck: OYe,
			determineRequestsReferrer: qYe,
			coarsenedSharedCurrentTime: lb,
			createDeferredPromise: VYe,
			isBlobLike: HYe,
			sameOrigin: QV,
			isCancelled: mp,
			isAborted: Use,
			isErrorLike: WYe,
			fullyReadBody: GYe,
			readableStreamClose: $Ye,
			isomorphicEncode: SD,
			urlIsLocal: YYe,
			urlIsHttpHttpsScheme: PV,
			urlHasHttpsScheme: KYe,
			clampAndCoarsenConnectionTimingInfo: JYe,
			simpleRangeHeaderValue: zYe,
			buildContentRange: jYe,
			createInflate: ZYe,
			extractMimeType: XYe,
		} = ga(),
		{ kState: Hse, kDispatcher: eKe } = Gf(),
		yp = require("assert"),
		{ safelyExtractBody: LV, extractBody: Ose } = s0(),
		{
			redirectStatusSet: Wse,
			nullBodyStatus: Gse,
			safeMethodsSet: tKe,
			requestBodyHeader: rKe,
			subresourceSet: nKe,
		} = SE(),
		iKe = require("events"),
		{ Readable: sKe, pipeline: oKe, finished: aKe } = require("stream"),
		{ addAbortListener: lKe, isErrored: cKe, isReadable: BD, bufferToLowerCasedHeaderName: qse } = Xt(),
		{ dataURLProcessor: uKe, serializeAMimeType: dKe, minimizeSupportedMimeType: fKe } = No(),
		{ getGlobalDispatcher: hKe } = dD(),
		{ webidl: gKe } = ys(),
		{ STATUS_CODES: pKe } = require("http"),
		AKe = ["GET", "HEAD"],
		mKe = typeof __UNDICI_IS_NODE__ < "u" || typeof esbuildDetection < "u" ? "node" : "undici",
		kV,
		DD = class extends iKe {
			constructor(t) {
				super(), (this.dispatcher = t), (this.connection = null), (this.dump = !1), (this.state = "ongoing")
			}
			terminate(t) {
				this.state === "ongoing" &&
					((this.state = "terminated"), this.connection?.destroy(t), this.emit("terminated", t))
			}
			abort(t) {
				this.state === "ongoing" &&
					((this.state = "aborted"),
					t || (t = new DOMException("The operation was aborted.", "AbortError")),
					(this.serializedAbortReason = t),
					this.connection?.destroy(t),
					this.emit("terminated", t))
			}
		}