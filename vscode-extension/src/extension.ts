import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { McpClient } from './mcpClient';
import { ContextViewProvider } from './views/contextView';
import { MemoriesViewProvider } from './views/memoriesView';

let authManager: AuthManager;
let mcpClient: McpClient;
let contextViewProvider: ContextViewProvider;
let memoriesViewProvider: MemoriesViewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Noble NovaCoreAI extension is now active!');

    // Initialize managers
    authManager = new AuthManager(context);
    mcpClient = new McpClient(authManager);

    // Initialize view providers
    contextViewProvider = new ContextViewProvider(context, mcpClient);
    memoriesViewProvider = new MemoriesViewProvider(context, mcpClient);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('novacore.contextView', contextViewProvider);
    vscode.window.registerTreeDataProvider('novacore.memoriesView', memoriesViewProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('novacore.authenticate', async () => {
            await authManager.authenticate();
            vscode.window.showInformationMessage('Authenticated with NovaCoreAI!');
            contextViewProvider.refresh();
            memoriesViewProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novacore.logout', async () => {
            await authManager.logout();
            vscode.window.showInformationMessage('Logged out from NovaCoreAI');
            contextViewProvider.refresh();
            memoriesViewProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novacore.fetchContext', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active file');
                return;
            }

            await contextViewProvider.fetchContextForFile(editor.document);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novacore.submitTask', async () => {
            const taskDescription = await vscode.window.showInputBox({
                prompt: 'Describe the task for the AI',
                placeHolder: 'e.g., Explain this function'
            });

            if (!taskDescription) {
                return;
            }

            const editor = vscode.window.activeTextEditor;
            const fileContext = editor ? editor.document.getText() : undefined;

            try {
                const result = await mcpClient.submitTask(taskDescription, fileContext);
                
                // Show result in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: result.response,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            } catch (error) {
                vscode.window.showErrorMessage(`Task submission failed: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novacore.showMemories', async () => {
            await memoriesViewProvider.refresh();
        })
    );

    // Listen for file open events
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (editor && getConfig().autoFetchContext) {
                await contextViewProvider.fetchContextForFile(editor.document);
            }
        })
    );

    // Listen for file save events
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (getConfig().autoLogChanges && authManager.isAuthenticated()) {
                await mcpClient.logMemory(
                    document.fileName,
                    'save',
                    document.getText(),
                    'success'
                );
            }
        })
    );

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'novacore.authenticate';
    statusBarItem.text = '$(robot) NovaCoreAI';
    statusBarItem.tooltip = 'Click to authenticate';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Update status bar on auth change
    authManager.onAuthChange(() => {
        if (authManager.isAuthenticated()) {
            statusBarItem.text = '$(check) NovaCoreAI';
            statusBarItem.tooltip = 'Connected to NovaCoreAI';
        } else {
            statusBarItem.text = '$(robot) NovaCoreAI';
            statusBarItem.tooltip = 'Click to authenticate';
        }
    });

    console.log('Noble NovaCoreAI extension fully activated');
}

export function deactivate() {
    console.log('Noble NovaCoreAI extension deactivated');
}

function getConfig() {
    const config = vscode.workspace.getConfiguration('novacore');
    return {
        apiUrl: config.get<string>('apiUrl', 'http://localhost:5000'),
        autoFetchContext: config.get<boolean>('autoFetchContext', true),
        autoLogChanges: config.get<boolean>('autoLogChanges', true)
    };
}
