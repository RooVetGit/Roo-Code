import "reflect-metadata"
import { container } from "tsyringe"
import { ExtensionContext } from "vscode"
import { ContextHolder, IExtensionContext } from "./core/contextHolder"

// Register VS Code-specific dependencies
export function configureContainer(context: ExtensionContext) {
	container.register(ExtensionContext, { useValue: context })
	container.registerSingleton(ContextHolder, ContextHolder)

	return container
}
//todo: remove this so that we can build it properly after building the singletons
