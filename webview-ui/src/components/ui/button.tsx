import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xs text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&>.start]:mr-2 [&>.content]:flex",
	{
		variants: {
			variant: {
				default:
					"border border-vscode-input-border bg-primary text-primary-foreground shadow hover:bg-primary/90 cursor-pointer",
				destructive:
					"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 cursor-pointer",
				outline:
					"border border-vscode-input-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
				secondary:
					"border border-vscode-input-border bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 cursor-pointer",
				ghost: "hover:bg-accent hover:text-accent-foreground cursor-pointer",
				link: "text-primary underline-offset-4 hover:underline cursor-pointer",
				combobox:
					"text-vscode-font-size font-normal text-popover-foreground bg-vscode-input-background border border-vscode-dropdown-border hover:bg-vscode-input-background/80 cursor-pointer",
				"ui-toolkit-primary":
					"font-display text-vscode-button-foreground bg-vscode-button-background border border-vscode-button-border rounded-[var(--size-cornerRadiusRound)] hover:bg-vscode-button-hoverBackground active:bg-vscode-button-background focus-visible:outline focus-visible:outline-[var(--size-borderWidth)] focus-visible:outline-vscode-focusBorder focus-visible:outline-offset-[calc(var(--size-borderWidth)*2)] disabled:opacity-[var(--opacity-disabled)] disabled:bg-vscode-button-background disabled:cursor-not-allowed cursor-pointer [&>svg]:w-[calc(var(--size-designUnit)*4px)] [&>svg]:h-[calc(var(--size-designUnit)*4px)] [&>.start]:mr-2 [&>.content]:flex",
				"ui-toolkit-secondary":
					"font-display text-vscode-button-secondaryForeground bg-vscode-button-secondaryBackground border border-vscode-button-border rounded-[var(--size-cornerRadiusRound)] hover:bg-vscode-button-secondaryHoverBackground active:bg-vscode-button-secondaryBackground focus-visible:outline focus-visible:outline-[var(--size-borderWidth)] focus-visible:outline-vscode-focusBorder focus-visible:outline-offset-[calc(var(--size-borderWidth)*2)] disabled:opacity-[var(--opacity-disabled)] disabled:bg-vscode-button-secondaryBackground disabled:cursor-not-allowed cursor-pointer [&>svg]:w-[calc(var(--size-designUnit)*4px)] [&>svg]:h-[calc(var(--size-designUnit)*4px)] [&>.start]:mr-2 [&>.content]:flex",
				"ui-toolkit-icon":
					"font-display text-vscode-foreground bg-vscode-button-iconBackground border-none rounded-[var(--size-button-iconCornerRadius)] hover:bg-vscode-button-iconHoverBackground hover:outline hover:outline-1 hover:outline-dotted hover:outline-vscode-contrastActiveBorder hover:outline-offset-[-1px] active:bg-vscode-button-iconHoverBackground focus-visible:outline focus-visible:outline-[var(--size-borderWidth)] focus-visible:outline-vscode-focusBorder focus-visible:outline-offset-[var(--size-button-iconFocusBorderOffset)] disabled:opacity-[var(--opacity-disabled)] disabled:bg-vscode-button-iconBackground disabled:cursor-not-allowed cursor-pointer [&>svg]:w-[calc(var(--size-designUnit)*4px)] [&>svg]:h-[calc(var(--size-designUnit)*4px)] [&>.content]:flex",
				"ui-toolkit-primary-no-border":
					"font-display text-vscode-button-foreground bg-vscode-button-background rounded-[var(--size-cornerRadiusRound)] hover:bg-vscode-button-hoverBackground active:bg-vscode-button-background focus-visible:outline focus-visible:outline-[var(--size-borderWidth)] focus-visible:outline-vscode-focusBorder focus-visible:outline-offset-[calc(var(--size-borderWidth)*2)] disabled:opacity-[var(--opacity-disabled)] disabled:bg-vscode-button-background disabled:cursor-not-allowed cursor-pointer [&>svg]:w-[calc(var(--size-designUnit)*4px)] [&>svg]:h-[calc(var(--size-designUnit)*4px)] [&>.start]:mr-2 [&>.content]:flex",
			},
			size: {
				default: "h-7 px-3",
				sm: "h-6 px-2 text-sm",
				lg: "h-8 px-4 text-lg",
				icon: "h-7 w-7",
				"ui-toolkit": "text-base p-[var(--size-button-paddingVertical)_var(--size-button-paddingHorizontal)]",
				"ui-toolkit-icon": "p-[var(--size-button-iconPadding)]",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button"

		// Set size to "ui-toolkit" when using ui-toolkit variants if no size is specified
		const adjustedSize =
			!size && variant?.includes("ui-toolkit")
				? variant === "ui-toolkit-icon"
					? "ui-toolkit-icon"
					: "ui-toolkit"
				: size

		return (
			<Comp
				className={cn(
					buttonVariants({ variant, size: adjustedSize, className }),
					variant?.includes("ui-toolkit") ? "ui-toolkit-button" : "",
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Button.displayName = "Button"

export { Button, buttonVariants }
