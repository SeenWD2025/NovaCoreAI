import * as vscode from 'vscode';
import { McpClient, MemoryItem } from '../mcpClient';

export class ContextViewProvider implements vscode.TreeDataProvider<ContextItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContextItem | undefined | null | void> = 
        new vscode.EventEmitter<ContextItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContextItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private context: vscode.ExtensionContext;
    private mcpClient: McpClient;
    private memories: MemoryItem[] = [];
    private currentFile: string | undefined;

    constructor(context: vscode.ExtensionContext, mcpClient: McpClient) {
        this.context = context;
        this.mcpClient = mcpClient;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ContextItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ContextItem): Promise<ContextItem[]> {
        if (!element) {
            // Root level
            if (this.memories.length === 0) {
                return [new ContextItem('No context available', '', vscode.TreeItemCollapsibleState.None)];
            }

            return this.memories.map(memory => 
                new ContextItem(
                    this.truncate(memory.content, 50),
                    memory.content,
                    vscode.TreeItemCollapsibleState.None,
                    memory.tier,
                    memory.confidence_score
                )
            );
        }

        return [];
    }

    async fetchContextForFile(document: vscode.TextDocument): Promise<void> {
        try {
            this.currentFile = document.fileName;
            
            const result = await this.mcpClient.fetchContext(
                document.fileName,
                document.getText().substring(0, 500), // First 500 chars
                document.languageId,
                5
            );

            this.memories = result.memories;
            this.refresh();

            if (result.memories.length > 0) {
                vscode.window.showInformationMessage(
                    `Found ${result.memories.length} relevant memories`
                );
            }
        } catch (error: any) {
            console.error('Failed to fetch context:', error);
            this.memories = [];
            this.refresh();
        }
    }

    private truncate(text: string, maxLength: number): string {
        const cleaned = text.replace(/\n/g, ' ').trim();
        if (cleaned.length <= maxLength) {
            return cleaned;
        }
        return cleaned.substring(0, maxLength) + '...';
    }
}

class ContextItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly fullContent: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly tier?: string,
        public readonly confidence?: number
    ) {
        super(label, collapsibleState);

        if (tier) {
            this.description = `${tier.toUpperCase()} (${(confidence || 0).toFixed(2)})`;
        }

        this.tooltip = fullContent;
        this.contextValue = 'contextItem';
    }

    iconPath = new vscode.ThemeIcon('file-text');
}
