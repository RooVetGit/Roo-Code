import React from "react"
import { render, RenderOptions } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@/components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "@/components/ui/standard-tooltip"

const testQueryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
})
interface AllTheProvidersProps {
	children: React.ReactNode
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
	return (
		<QueryClientProvider client={testQueryClient}>
			<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>{children}</TooltipProvider>
		</QueryClientProvider>
	)
}

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
	render(ui, { wrapper: AllTheProviders, ...options })

// re-export everything
export * from "@testing-library/react"

// override render method
export { customRender as render }
