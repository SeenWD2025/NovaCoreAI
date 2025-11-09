import * as vscode from 'vscode';
import { McpClient } from '../mcpClient';

export class MemoriesViewProvider implements vscode.TreeDataProvider<MemoryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MemoryTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<MemoryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MemoryTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private context: vscode.ExtensionContext;
    private mcpClient: McpClient;

    constructor(context: vscode.ExtensionContext, mcpClient: McpClient) {
        this.context = context;
        this.mcpClient = mcpClient;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MemoryTreeItem): Promise<MemoryTreeItem[]> {
        if (!element) {
            // Root level - show placeholder for now
            return [
                new MemoryTreeItem('Recent memories will appear here', vscode.TreeItemCollapsibleState.None),
                new MemoryTreeItem('Use "Fetch Context" to load memories', vscode.TreeItemCollapsibleState.None)
            ];
        }

        return [];
    }
}

class MemoryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.contextValue = 'memoryItem';
    }

    iconPath = new vscode.ThemeIcon('database');
}
