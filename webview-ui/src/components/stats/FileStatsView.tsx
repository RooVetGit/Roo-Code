import React, { useMemo } from "react"
import { Virtuoso } from "react-virtuoso"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { FileInteraction } from "@roo/shared/WebviewMessage"

interface FileStatsViewProps {
  fileInteractions: FileInteraction[]
  taskId?: string
  onBack: () => void // To return to chat view
}

const FileStatsView: React.FC<FileStatsViewProps> = ({
  fileInteractions,
  taskId,
  onBack,
}) => {
  const { t } = useAppTranslation()

  // Calculate stats from file interactions
  const stats = useMemo(() => {
    // Total tool count
    const totalToolCount = fileInteractions.length

    // Get unique files with write operations
    const writtenFiles = Array.from(
      new Set(
        fileInteractions
          .filter((i) =>
            ["write", "edit", "create", "insert", "search_replace"].includes(
              i.operation
            )
          )
          .map((i) => i.path)
      )
    ).sort()

    // Get unique files with read operations
    const readFiles = Array.from(
      new Set(
        fileInteractions
          .filter((i) =>
            ["read", "list", "search"].includes(i.operation)
          )
          .map((i) => i.path)
      )
    ).sort()

    // Count operations by type
    const operationCounts: Record<string, number> = {}
    fileInteractions.forEach((interaction) => {
      operationCounts[interaction.operation] = (operationCounts[interaction.operation] || 0) + 1
    })

    return {
      totalToolCount,
      writtenFiles,
      readFiles,
      operationCounts,
    }
  }, [fileInteractions])

  // Function to open a file
  const openFile = (path: string) => {
    vscode.postMessage({ type: "openFile", path })
  }

  // Create virtuoso data array
  const sections = useMemo(() => {
    return [
      { type: "summary", title: "Summary" },
      { type: "written", title: "Written Files", items: stats.writtenFiles },
      { type: "read", title: "Read Files", items: stats.readFiles },
    ]
  }, [stats])

  const renderItem = (index: number) => {
    const section = sections[index]

    if (section.type === "summary") {
      return (
        <div className="file-stats-summary p-4 mb-4 bg-vscode-panel-background rounded">
          <h2 className="text-lg font-medium mb-3">{t("stats:toolUsageSummary", "Tool Usage Summary")}</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 bg-vscode-editor-background rounded">
              <div className="text-3xl font-medium">{stats.totalToolCount}</div>
              <div className="text-sm text-vscode-descriptionForeground">{t("stats:totalOperations", "Total Operations")}</div>
            </div>
            <div className="p-3 bg-vscode-editor-background rounded">
              <div className="text-3xl font-medium">{stats.writtenFiles.length}</div>
              <div className="text-sm text-vscode-descriptionForeground">{t("stats:filesModified", "Files Modified")}</div>
            </div>
          </div>
          
          <h3 className="text-sm font-medium mb-2">{t("stats:operationsByType", "Operations by Type:")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(stats.operationCounts).map(([op, count]) => (
              <div key={op} className="flex justify-between items-center text-sm bg-vscode-editor-background p-2 rounded">
                <span>{op.charAt(0).toUpperCase() + op.slice(1)}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (section.type === "written") {
      return (
        <div className="file-stats-written mb-4">
          <h2 className="text-lg font-medium p-3 bg-vscode-panel-background rounded mb-2">
            {t("stats:writtenFiles", "Written Files")} ({stats.writtenFiles.length})
          </h2>
          {stats.writtenFiles.length === 0 ? (
            <div className="p-3 text-vscode-descriptionForeground">{t("stats:noWrittenFiles", "No files have been written yet.")}</div>
          ) : (
            <div className="bg-vscode-panel-background rounded">
              {stats.writtenFiles.map((path) => (
                <div
                  key={path}
                  className="flex items-center p-3 border-b border-[color-mix(in_srgb,_var(--vscode-editor-foreground)_15%,_transparent)] cursor-pointer hover:bg-[color-mix(in_srgb,_var(--vscode-editor-background)_95%,_var(--vscode-editor-foreground))]"
                  onClick={() => openFile(path)}
                >
                  <span className="codicon codicon-edit mr-2 text-vscode-notificationsWarningIcon"></span>
                  <div className="flex-1 text-sm overflow-hidden">
                    <div className="font-medium truncate">{path.split('/').pop()}</div>
                    <div className="text-xs text-vscode-descriptionForeground truncate">{path}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (section.type === "read") {
      return (
        <div className="file-stats-read">
          <h2 className="text-lg font-medium p-3 bg-vscode-panel-background rounded mb-2">
            {t("stats:readFiles", "Read Files")} ({stats.readFiles.length})
          </h2>
          {stats.readFiles.length === 0 ? (
            <div className="p-3 text-vscode-descriptionForeground">{t("stats:noReadFiles", "No files have been read yet.")}</div>
          ) : (
            <div className="bg-vscode-panel-background rounded">
              {stats.readFiles.map((path) => (
                <div
                  key={path}
                  className="flex items-center p-3 border-b border-[color-mix(in_srgb,_var(--vscode-editor-foreground)_15%,_transparent)] cursor-pointer hover:bg-[color-mix(in_srgb,_var(--vscode-editor-background)_95%,_var(--vscode-editor-foreground))]"
                  onClick={() => openFile(path)}
                >
                  <span className="codicon codicon-file mr-2 text-vscode-notificationsInfoIcon"></span>
                  <div className="flex-1 text-sm overflow-hidden">
                    <div className="font-medium truncate">{path.split('/').pop()}</div>
                    <div className="text-xs text-vscode-descriptionForeground truncate">{path}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="file-stats-view h-full w-full flex flex-col">
      <div className="p-3 border-b border-[color-mix(in_srgb,_var(--vscode-editor-foreground)_15%,_transparent)] flex items-center">
        <VSCodeButton appearance="icon" onClick={onBack}>
          <span className="codicon codicon-chevron-left"></span>
        </VSCodeButton>
        <h2 className="ml-2 text-base font-medium">
          {t("stats:title", "Tool Stats")}
          <span className="ml-1 text-sm text-vscode-descriptionForeground">
            ({fileInteractions.length})
          </span>
        </h2>
      </div>

      <Virtuoso
        className="flex-grow overflow-auto w-full"
        data={sections}
        itemContent={(index) => renderItem(index)}
        overscan={200}
      />
    </div>
  )
}

export default FileStatsView
