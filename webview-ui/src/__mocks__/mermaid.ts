const mermaid = {
	initialize: jest.fn(),
	render: jest.fn().mockResolvedValue({ svg: "<svg></svg>" }),
	parse: jest.fn(),
	parseDirective: jest.fn(),
	registerExternalDiagrams: jest.fn(),
	contentLoaded: jest.fn(),
	setParseErrorHandler: jest.fn(),
	getDiagramFromText: jest.fn(),
	getConfig: jest.fn().mockReturnValue({}),
	setConfig: jest.fn(),
	getSiteConfig: jest.fn(),
	updateSiteConfig: jest.fn(),
	reset: jest.fn(),
	startOnLoad: true,
	mermaidAPI: {
		render: jest.fn().mockResolvedValue({ svg: "<svg></svg>" }),
		parse: jest.fn(),
		initialize: jest.fn(),
		getConfig: jest.fn().mockReturnValue({}),
		setConfig: jest.fn(),
		getSiteConfig: jest.fn(),
		updateSiteConfig: jest.fn(),
		reset: jest.fn(),
	},
}

export default mermaid
