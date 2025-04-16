export const SELECTOR_SEPARATOR = "/"
export function stringifyVsCodeLmModelSelector(selector) {
	return [selector.vendor, selector.family, selector.version, selector.id].filter(Boolean).join(SELECTOR_SEPARATOR)
}
//# sourceMappingURL=vsCodeSelectorUtils.js.map
