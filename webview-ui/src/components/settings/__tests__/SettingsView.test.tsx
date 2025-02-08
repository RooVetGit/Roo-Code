import React from "react"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"
import SettingsView from "../SettingsView"
import { ExtensionStateContextProvider } from "../../../context/ExtensionStateContext"
import { vscode } from "../../../utils/vscode"

// Mock vscode API
jest.mock("../../../utils/vscode", () => ({
  vscode: {
    postMessage: jest.fn().mockImplementation(() => {
      return Promise.resolve().then(() => {
        // Call onDone after the promise resolves
        if (onDone) {
          onDone();
        }
      });
    }),
  },
}));

// Mock ApiConfigManager component
jest.mock("../ApiConfigManager", () => ({
  __esModule: true,
  default: ({
    currentApiConfigName,
    listApiConfigMeta,
    onSelectConfig,
    onDeleteConfig,
    onRenameConfig,
    onUpsertConfig,
  }: any) => (
    <div data-testid="api-config-management">
      <span>Current config: {currentApiConfigName}</span>
    </div>
  ),
}))

// Mock VSCode components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
  VSCodeButton: ({ children, onClick, appearance }: any) =>
    appearance === "icon" ? (
      <button onClick={onClick} className="codicon codicon-close" aria-label="Remove command">
        <span className="codicon codicon-close" />
      </button>
    ) : (
      <button onClick={onClick} data-appearance={appearance}>
        {children}
      </button>
    ),
  VSCodeCheckbox: ({ children, onChange, checked }: any) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange({ target: { checked: e.target.checked } })}
        aria-label={typeof children === "string" ? children : undefined}
      />
      {children}
    </label>
  ),
  VSCodeTextField: ({ value, onInput, placeholder }: any) => (
    <input
      type="text"
      value={value}
      onChange={(e) => onInput({ target: { value: e.target.value } })}
      placeholder={placeholder}
    />
  ),
  VSCodeTextArea: () => <textarea />,
  VSCodeLink: ({ children, href }: any) => <a href={href || "#"}>{children}</a>,
  VSCodeDropdown: ({ children, value, onChange }: any) => (
    <select value={value} onChange={onChange}>
      {children}
    </select>
  ),
  VSCodeOption: ({ children, value }: any) => <option value={value}>{children}</option>,
  VSCodeRadio: ({ children, value, checked, onChange }: any) => (
    <input type="radio" value={value} checked={checked} onChange={onChange} />
  ),
  VSCodeRadioGroup: ({ children, value, onChange }: any) => <div onChange={onChange}>{children}</div>,
  VSCodeSlider: ({ value, onChange }: any) => (
    <input
      type="range"
      value={value}
      onChange={(e) => onChange({ target: { value: Number(e.target.value) } })}
      min={0}
      max={1}
      step={0.01}
      style={{ flexGrow: 1, height: "2px" }}
    />
  ),
}));
let onDone : any;
const renderSettingsView = async () => {
    onDone = jest.fn();
    render(
        <ExtensionStateContextProvider>
            <SettingsView onDone={onDone} />
        </ExtensionStateContextProvider>
    )
    return { onDone };
}

describe("SettingsView - Sound Settings", () => {
    beforeEach(async () => {
        jest.clearAllMocks()
    })

    it("initializes with sound disabled by default", async () => {
        await renderSettingsView()

        const soundCheckbox = screen.getByRole("checkbox", {
            name: /Enable sound effects/i,
        })
        // Expect initial getSemanticSearchStatus message
        expect(vscode.postMessage).toHaveBeenCalledWith({
            type: "getSemanticSearchStatus",
        });
        expect(soundCheckbox).not.toBeChecked()

        // Volume slider should not be visible when sound is disabled
        expect(screen.queryByRole("slider", { name: /volume/i })).not.toBeInTheDocument()
    })

    it("toggles sound setting and sends message to VSCode", async () => {
        const { onDone } = await renderSettingsView()

        const soundCheckbox = screen.getByRole("checkbox", {
            name: /Enable sound effects/i,
        })

        // Enable sound
        fireEvent.click(soundCheckbox);
        await waitFor(() => expect(soundCheckbox).toBeChecked(), { timeout: 5000 });

        // Click Done to save settings
        const doneButton = screen.getByText("Done");
        fireEvent.click(doneButton);
        await waitFor(() =>
            expect(vscode.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "saveAllSettings",
                    settings: expect.objectContaining({
                        soundEnabled: true,
                    }),
                }),
            ), { timeout: 5000 }
        );
        expect(onDone).toHaveBeenCalled();
    })

    it("shows volume slider when sound is enabled", async () => {
        await renderSettingsView()

        // Enable sound
        const soundCheckbox = screen.getByRole("checkbox", {
            name: /Enable sound effects/i,
        })
        fireEvent.click(soundCheckbox)

        // Volume slider should be visible
        const volumeSlider = screen.getByRole("slider", { name: /volume/i })
        expect(volumeSlider).toBeInTheDocument()
        expect(volumeSlider).toHaveValue("0.5")
    })

    it("updates volume and sends message to VSCode when slider changes", async () => {
        const { onDone } = await renderSettingsView();

        // Enable sound
        const soundCheckbox = screen.getByRole("checkbox", {
            name: /Enable sound effects/i,
        });
        fireEvent.click(soundCheckbox);
        await act(() => Promise.resolve());

        // Change volume
        const volumeSlider = screen.getByRole("slider", { name: /volume/i });
        fireEvent.change(volumeSlider, { target: { value: "0.75" } });
        await waitFor(() => expect(volumeSlider).toHaveValue("0.75"));

        // Click Done to save settings
        const doneButton = screen.getByText("Done");
        fireEvent.click(doneButton);
        await waitFor(() =>
            expect(vscode.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "saveAllSettings",
                    settings: expect.objectContaining({
                        soundVolume: 0.75,
                    }),
                }),
            )
        );
        expect(onDone).toHaveBeenCalled();
    });
});

describe("SettingsView - API Configuration", () => {
    beforeEach(async () => {
        jest.clearAllMocks()
    })

    it("renders ApiConfigManagement with correct props", async () => {
        await renderSettingsView()

        expect(screen.getByTestId("api-config-management")).toBeInTheDocument()
    })
})

describe("SettingsView - Allowed Commands", () => {
    beforeEach(async () => {
        jest.clearAllMocks()
    })

    it("shows allowed commands section when alwaysAllowExecute is enabled", async () => {
        await renderSettingsView()

        // Enable always allow execute
        const executeCheckbox = screen.getByRole("checkbox", {
            name: /Always approve allowed execute operations/i,
        })
        fireEvent.click(executeCheckbox);
        await waitFor(() =>
            expect(screen.getByText(/Allowed Auto-Execute Commands/i)),
        );
        expect(screen.getByPlaceholderText(/Enter command prefix/i)).toBeInTheDocument()
    })

    it("adds new command to the list", async () => {
        await renderSettingsView()

        // Enable always allow execute
        const executeCheckbox = screen.getByRole("checkbox", {
            name: /Always approve allowed execute operations/i,
        })
        fireEvent.click(executeCheckbox);
        await waitFor(() =>
            expect(screen.getByText(/Allowed Auto-Execute Commands/i)),
        );

        // Add a new command
        const input = screen.getByPlaceholderText(/Enter command prefix/i)
          const addButton = screen.getByText("Add")
        act(() => {
            fireEvent.change(input, { target: { value: "npm test" } });
            fireEvent.click(addButton);
          });
          await waitFor(() => expect(screen.getByText("npm test")), {
            timeout: 10000,
          });

        // Verify command was added
        expect(screen.getByText("npm test")).toBeInTheDocument()

        // Verify VSCode message was sent
        expect(vscode.postMessage).toHaveBeenCalledWith({
            type: "allowedCommands",
            commands: ["npm test"],
        })
    })

    it("removes command from the list", async () => {
        const { onDone } = await renderSettingsView();

        // Enable always allow execute
        const executeCheckbox = screen.getByRole("checkbox", {
            name: /Always approve allowed execute operations/i,
        })
        fireEvent.click(executeCheckbox);
        await waitFor(() =>
            expect(screen.getByText(/Allowed Auto-Execute Commands/i)),
        );

        // Add a command
        const input = screen.getByPlaceholderText(/Enter command prefix/i)
        fireEvent.change(input, { target: { value: "npm test" } })
        const addButton = screen.getByText("Add")
        fireEvent.click(addButton);
        await waitFor(() => expect(screen.getByText("npm test")));

        // Remove the command
        const removeButton = screen.getByRole("button", { name: "Remove command" })
        fireEvent.click(removeButton);
        await waitFor(() =>
            expect(screen.queryByText("npm test")).not.toBeInTheDocument(),
        );

        // Verify command was removed
        expect(screen.queryByText("npm test")).not.toBeInTheDocument();

        // Click Done to save settings
        const doneButton = screen.getByText("Done");
        fireEvent.click(doneButton);
        await waitFor(() =>
            expect(vscode.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "saveAllSettings",
                    settings: expect.objectContaining({
                        allowedCommands: [],
                    }),
                }),
            ),
        );
        await waitFor(() => expect(onDone).toHaveBeenCalled());
    });

    it("prevents duplicate commands", async () => {
        const { onDone } = await renderSettingsView();

        // Enable always allow execute
        const executeCheckbox = screen.getByRole("checkbox", {
            name: /Always approve allowed execute operations/i,
        })
        fireEvent.click(executeCheckbox)

        // Add a command twice
        const input = screen.getByPlaceholderText(/Enter command prefix/i)
        const addButton = screen.getByText("Add")

        // First addition
        fireEvent.change(input, { target: { value: "npm test" } })
        fireEvent.click(addButton)

        // Second addition attempt
        fireEvent.change(input, { target: { value: "npm test" } })
        fireEvent.click(addButton)

        // Verify command appears only once
        const commands = screen.getAllByText("npm test")
        expect(commands).toHaveLength(1)
    })

    it("saves allowed commands when clicking Done", async () => {
        const { onDone } = await renderSettingsView()

        // Enable always allow execute
        const executeCheckbox = screen.getByRole("checkbox", {
            name: /Always approve allowed execute operations/i,
        })
        fireEvent.click(executeCheckbox);
        await waitFor(() =>
            expect(screen.getByText(/Allowed Auto-Execute Commands/i)),
        );

        // Add a command
        const input = screen.getByPlaceholderText(/Enter command prefix/i)
        fireEvent.change(input, { target: { value: "npm test" } })
        const addButton = screen.getByText("Add")
        fireEvent.click(addButton);
        await waitFor(() => expect(screen.getByText("npm test")));

        // Click Done
        const doneButton = screen.getByText("Done")
        fireEvent.click(doneButton);
        await waitFor(() =>
            expect(vscode.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "saveAllSettings",
                    settings: expect.objectContaining({
                        allowedCommands: ["npm test"],
                    }),
                }),
            ),
        );
        expect(onDone).toHaveBeenCalled()
    })
})
