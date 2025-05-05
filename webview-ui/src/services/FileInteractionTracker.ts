import { FileInteraction } from "@roo/shared/WebviewMessage";

export class FileInteractionTracker {
  private static instance: FileInteractionTracker;
  private interactions: Map<string, FileInteraction[]> = new Map(); // taskId -> interactions
  private currentTaskId: string | undefined;
  
  // Singleton pattern
  public static getInstance(): FileInteractionTracker {
    if (!FileInteractionTracker.instance) {
      FileInteractionTracker.instance = new FileInteractionTracker();
    }
    return FileInteractionTracker.instance;
  }
  
  // Set current task
  public setCurrentTask(taskId: string): void {
    this.currentTaskId = taskId;
    if (!this.interactions.has(taskId)) {
      this.interactions.set(taskId, []);
    }
  }
  
  // Record a file interaction
  public recordInteraction(interaction: FileInteraction): void {
    const taskId = interaction.taskId || this.currentTaskId;
    if (!taskId) {
      console.warn("No task ID provided for file interaction");
      return;
    }
    
    // Initialize array if needed
    if (!this.interactions.has(taskId)) {
      this.interactions.set(taskId, []);
    }
    
    // Add timestamp if not provided
    const fullInteraction = {
      ...interaction,
      taskId,
      timestamp: interaction.timestamp || Date.now()
    };
    
    // Add to interactions
    this.interactions.get(taskId)!.push(fullInteraction);
    
    // Notify listeners (WebView, etc.)
    this.notifyInteractionRecorded(taskId, fullInteraction);
  }
  
  // Get all interactions for a task
  public getInteractionsForTask(taskId: string): FileInteraction[] {
    return this.interactions.get(taskId) || [];
  }
  
  // Get write operations for a task
  public getWriteOperationsForTask(taskId: string): FileInteraction[] {
    const allInteractions = this.getInteractionsForTask(taskId);
    return allInteractions.filter(i => ['write', 'edit', 'create', 'insert', 'search_replace'].includes(i.operation));
  }
  
  // Get read operations for a task
  public getReadOperationsForTask(taskId: string): FileInteraction[] {
    const allInteractions = this.getInteractionsForTask(taskId);
    return allInteractions.filter(i => ['read', 'list', 'search'].includes(i.operation));
  }
  
  // Clear interactions for a task
  public clearInteractionsForTask(taskId: string): void {
    this.interactions.delete(taskId);
  }
  
  // Event handling for UI updates
  private listeners: ((taskId: string, interaction: FileInteraction) => void)[] = [];
  
  public addInteractionListener(listener: (taskId: string, interaction: FileInteraction) => void): void {
    this.listeners.push(listener);
  }
  
  public removeInteractionListener(listener: (taskId: string, interaction: FileInteraction) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  private notifyInteractionRecorded(taskId: string, interaction: FileInteraction): void {
    this.listeners.forEach(listener => listener(taskId, interaction));
  }
  
  // Persistence methods
  public serialize(): Record<string, FileInteraction[]> {
    const result: Record<string, FileInteraction[]> = {};
    this.interactions.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  public deserialize(data: Record<string, FileInteraction[]>): void {
    this.interactions.clear();
    Object.entries(data).forEach(([key, value]) => {
      this.interactions.set(key, value);
    });
  }
}
