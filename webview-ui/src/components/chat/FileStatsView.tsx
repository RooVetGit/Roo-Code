import React, { useState, useMemo } from 'react'
import { VSCodeButton, VSCodeDivider } from '@vscode/webview-ui-toolkit/react'
import { FileInteraction } from '@roo/shared/WebviewMessage'
import { vscode } from '@src/utils/vscode'
import { useAppTranslation } from '@src/i18n/TranslationContext'

interface FileStatsViewProps {
  fileInteractions: FileInteraction[]
}

/**
 * FileStatsView component displays statistics about file tools used during a task
 */
const FileStatsView: React.FC<FileStatsViewProps> = ({ fileInteractions }) => {
  const { t } = useAppTranslation()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    writtenFiles: true,
    toolStats: true,
    readFiles: false
  })

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Group files by tool type and remove duplicates
  const stats = useMemo(() => {
    const allInteractions = [...fileInteractions]
    
    // Sort by timestamp (newest first)
    allInteractions.sort((a, b) => b.timestamp - a.timestamp)
    
    // Track unique file paths by tool type
    const uniqueFilePaths = new Map<string, Set<string>>()
    const toolCounts: Record<string, number> = {
      read: 0,
      write: 0,
      create: 0,
      edit: 0,
      total: 0
    }
    
    // Process interactions and count tools
    allInteractions.forEach(interaction => {
      // Count tool
      toolCounts[interaction.operation] = (toolCounts[interaction.operation] || 0) + 1
      toolCounts.total++
      
      // Track unique file paths by tool
      if (!uniqueFilePaths.has(interaction.operation)) {
        uniqueFilePaths.set(interaction.operation, new Set())
      }
      uniqueFilePaths.get(interaction.operation)?.add(interaction.path)
    })
    
    // Get unique read and written files
    const readFiles = Array.from(uniqueFilePaths.get('read') || new Set<string>()) // Ensure correct type
    
    // Collect all write-related files
    const writtenFiles: string[] = [ // Ensure the final array is string[]
      ...Array.from(uniqueFilePaths.get('write') || new Set<string>()), // Specify <string> for fallback
      ...Array.from(uniqueFilePaths.get('create') || new Set<string>()), // Specify <string> for fallback
      ...Array.from(uniqueFilePaths.get('edit') || new Set<string>())    // Specify <string> for fallback
    ]
    
    // Remove duplicates from written files
    const uniqueWrittenFiles: string[] = Array.from(new Set(writtenFiles)) // Explicitly type as string[]
    
    // Calculate file counts by type
    const fileCounts = {
      readFiles: readFiles.length,
      writtenFiles: uniqueWrittenFiles.length,
      writeFiles: uniqueFilePaths.get('write')?.size || 0,
      createFiles: uniqueFilePaths.get('create')?.size || 0,
      editFiles: uniqueFilePaths.get('edit')?.size || 0
    }
    
    return {
      readFiles,
      writtenFiles: uniqueWrittenFiles,
      toolCounts,
      fileCounts
    }
  }, [fileInteractions])

  // Open a file in the editor
  const openFile = (path: string) => {
    // Send a message to open the file using the 'openFile' message type
    vscode.postMessage({
      type: 'openFile', // Correct message type
      text: path // Use 'text' property for file path
      // Removed invalid 'options' property
    })
  }

  // Define translation strings with better UX writing
  const labels = {
    title: "Tool Stats",
    summary: (count: number) => `${count} file tool ${count === 1 ? 'use' : 'uses'} in this task`,
    toolStats: "Tool Statistics",
    reads: "Read",
    writes: "Write",
    creates: "Create",
    edits: "Edit",
    readFiles: "Read Files",
    noFiles: "No files in this category",
    writtenFiles: "Written Files"
  }

  // Tool descriptions for tooltips
  const toolDescriptions = {
    reads: "Accessing file contents without modification",
    writes: "Overwriting existing files with new content",
    creates: "Creating new files that didn't exist before",
    edits: "Modifying specific parts of existing files"
  }

  // Render file list with icons based on tool
  const renderFileList = (files: string[], type: 'read' | 'written') => {
    if (files.length === 0) {
      return <div className="text-vscode-foreground opacity-50 p-2">{labels.noFiles}</div>
    }

    return (
      <div className="max-h-[250px] overflow-y-auto px-2">
        {files.map((file, index) => {
          // Extract filename for display (show just the filename, not the full path)
          const fileName = file.split(/[\/\\]/).pop() || file;
          
          return (
            <div
              key={`${type}-${index}`}
              className="flex items-center p-2 hover:bg-[var(--vscode-list-hoverBackground)] rounded cursor-pointer" // Use standard list hover background
              onClick={() => openFile(file)}
              title={file}
            >
              <span className="truncate text-vscode-foreground">{fileName}</span>
            </div>
          );
        })}
      </div>
    )
  }

  // Render tool count statistics
  const renderToolStats = () => {
    const { fileCounts } = stats
    
    const cardStyle = {
      backgroundColor: 'var(--vscode-editor-background)',
      border: '1px solid var(--vscode-panel-border)'
    };
    
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
        <div className="p-3 rounded relative" style={cardStyle}>
          <div className="flex justify-between items-center">
            <div className="text-xs text-vscode-foreground opacity-70">{labels.reads}</div>
            <div className="text-xs text-vscode-foreground opacity-70 cursor-help rounded-full w-5 h-5 flex items-center justify-center hover:bg-vscode-panel-border" title={toolDescriptions.reads}>?</div>
          </div>
          <div className="text-xl font-semibold text-vscode-foreground">{fileCounts.readFiles}</div>
        </div>
        <div className="p-3 rounded relative" style={cardStyle}>
          <div className="flex justify-between items-center">
            <div className="text-xs text-vscode-foreground opacity-70">{labels.writes}</div>
            <div className="text-xs text-vscode-foreground opacity-70 cursor-help rounded-full w-5 h-5 flex items-center justify-center hover:bg-vscode-panel-border" title={toolDescriptions.writes}>?</div>
          </div>
          <div className="text-xl font-semibold text-vscode-foreground">{fileCounts.writeFiles}</div>
        </div>
        <div className="p-3 rounded relative" style={cardStyle}>
          <div className="flex justify-between items-center">
            <div className="text-xs text-vscode-foreground opacity-70">{labels.creates}</div>
            <div className="text-xs text-vscode-foreground opacity-70 cursor-help rounded-full w-5 h-5 flex items-center justify-center hover:bg-vscode-panel-border" title={toolDescriptions.creates}>?</div>
          </div>
          <div className="text-xl font-semibold text-vscode-foreground">{fileCounts.createFiles}</div>
        </div>
        <div className="p-3 rounded relative" style={cardStyle}>
          <div className="flex justify-between items-center">
            <div className="text-xs text-vscode-foreground opacity-70">{labels.edits}</div>
            <div className="text-xs text-vscode-foreground opacity-70 cursor-help rounded-full w-5 h-5 flex items-center justify-center hover:bg-vscode-panel-border" title={toolDescriptions.edits}>?</div>
          </div>
          <div className="text-xl font-semibold text-vscode-foreground">{fileCounts.editFiles}</div>
        </div>
      </div>
    )
  }
  
  // Removed containerStyle object
  
  if (fileInteractions.length === 0) {
    // Apply vscode-body class for correct background in empty state
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-vscode-foreground p-4 vscode-body">
        <span className="codicon codicon-file-binary text-5xl mb-4 opacity-50"></span>
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">No File Tools Used</h3>
          <p className="opacity-70">File tool usage will appear here as tasks run</p>
        </div>
      </div>
    )
  }

  return (
    // Apply vscode-body class for correct background in populated state
    <div className="w-full h-full flex flex-col overflow-y-auto text-vscode-foreground vscode-body">
      {/* Sticky header should inherit background */}
      <div className="p-4 sticky top-0 z-10 flex items-center justify-between"> {/* Reverted to horizontal flex layout */}
        <h2 className="font-semibold text-lg flex items-center"> {/* Title without icon */}
          {/* Removed graph icon */}
          {labels.title}
        </h2>
        {/* Summary text */}
        <div className="text-sm opacity-70">{labels.summary(stats.toolCounts.total)}</div> {/* Moved summary text */}
      </div>

      <VSCodeDivider />

      {/* Written Files Section - Now first */}
      {/* Section container should inherit background */}
      <div className="mb-4">
        <div
          className="px-4 py-2 flex justify-between items-center cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] rounded" // Use standard list hover background
          onClick={() => toggleSection('writtenFiles')}
        >
          <div className="font-medium">
            {labels.writtenFiles}
            <span className="ml-2 text-xs opacity-70">({stats.writtenFiles.length})</span>
          </div>
          <span className={`codicon ${expandedSections.writtenFiles ? 'codicon-chevron-up' : 'codicon-chevron-down'}`}></span>
        </div>
        {/* Render content directly */}
        {expandedSections.writtenFiles && <div>{renderFileList(stats.writtenFiles, 'written')}</div>}
      </div>

      <VSCodeDivider />

      {/* Tool Statistics - Now second */}
      {/* Section container should inherit background */}
      <div className="mb-4">
        <div
          className="px-4 py-2 flex justify-between items-center cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] rounded" // Use standard list hover background
          onClick={() => toggleSection('toolStats')}
        >
          <div className="font-medium">{labels.toolStats}</div>
          <span className={`codicon ${expandedSections.toolStats ? 'codicon-chevron-up' : 'codicon-chevron-down'}`}></span>
        </div>
        {/* Render content directly */}
        {expandedSections.toolStats && <div>{renderToolStats()}</div>}
      </div>

      <VSCodeDivider />

      {/* Read Files Section - Now third and collapsed by default */}
      {/* Section container should inherit background */}
      <div className="mb-4">
        <div
          className="px-4 py-2 flex justify-between items-center cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] rounded" // Use standard list hover background
          onClick={() => toggleSection('readFiles')}
        >
          <div className="font-medium">
            {labels.readFiles}
            <span className="ml-2 text-xs opacity-70">({stats.readFiles.length})</span>
          </div>
          <span className={`codicon ${expandedSections.readFiles ? 'codicon-chevron-up' : 'codicon-chevron-down'}`}></span>
        </div>
        {/* Render content directly */}
        {expandedSections.readFiles && <div>{renderFileList(stats.readFiles, 'read')}</div>}
      </div>
    </div>
  )
}

export default FileStatsView