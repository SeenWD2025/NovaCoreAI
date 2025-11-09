import * as vscode from 'vscode';
import axios from 'axios';

export class AuthManager {
    private context: vscode.ExtensionContext;
    private authChangeCallbacks: (() => void)[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async authenticate(): Promise<void> {
        // For MVP, use simple email/password authentication
        // In production, implement OAuth device code flow

        const apiUrl = this.getApiUrl();
        
        const authMethod = await vscode.window.showQuickPick(
            ['Login', 'Register'],
            { placeHolder: 'Choose authentication method' }
        );

        if (!authMethod) {
            return;
        }

        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'user@example.com',
            validateInput: (value) => {
                if (!value || !value.includes('@')) {
                    return 'Please enter a valid email';
                }
                return null;
            }
        });

        if (!email) {
            return;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true,
            validateInput: (value) => {
                if (!value || value.length < 6) {
                    return 'Password must be at least 6 characters';
                }
                return null;
            }
        });

        if (!password) {
            return;
        }

        try {
            if (authMethod === 'Register') {
                await this.register(apiUrl, email, password);
            } else {
                await this.login(apiUrl, email, password);
            }

            this.notifyAuthChange();
        } catch (error: any) {
            const message = error.response?.data?.error || error.message || 'Authentication failed';
            vscode.window.showErrorMessage(`Authentication failed: ${message}`);
            throw error;
        }
    }

    private async register(apiUrl: string, email: string, password: string): Promise<void> {
        const response = await axios.post(`${apiUrl}/api/auth/register`, {
            email,
            password
        });

        // Store tokens
        await this.storeTokens(response.data.accessToken, response.data.refreshToken);
        await this.context.secrets.store('novacore.userId', response.data.user.id);
        await this.context.secrets.store('novacore.userEmail', email);
    }

    private async login(apiUrl: string, email: string, password: string): Promise<void> {
        const response = await axios.post(`${apiUrl}/api/auth/login`, {
            email,
            password
        });

        // Store tokens
        await this.storeTokens(response.data.accessToken, response.data.refreshToken);
        await this.context.secrets.store('novacore.userId', response.data.user.id);
        await this.context.secrets.store('novacore.userEmail', email);
    }

    private async storeTokens(accessToken: string, refreshToken: string): Promise<void> {
        await this.context.secrets.store('novacore.accessToken', accessToken);
        await this.context.secrets.store('novacore.refreshToken', refreshToken);
    }

    async getAccessToken(): Promise<string | undefined> {
        return await this.context.secrets.get('novacore.accessToken');
    }

    async getUserId(): Promise<string | undefined> {
        return await this.context.secrets.get('novacore.userId');
    }

    async logout(): Promise<void> {
        await this.context.secrets.delete('novacore.accessToken');
        await this.context.secrets.delete('novacore.refreshToken');
        await this.context.secrets.delete('novacore.userId');
        await this.context.secrets.delete('novacore.userEmail');
        this.notifyAuthChange();
    }

    isAuthenticated(): boolean {
        // Check if we have an access token stored
        return this.context.secrets.get('novacore.accessToken').then(token => !!token) as any;
    }

    getApiUrl(): string {
        const config = vscode.workspace.getConfiguration('novacore');
        return config.get<string>('apiUrl', 'http://localhost:5000');
    }

    onAuthChange(callback: () => void): void {
        this.authChangeCallbacks.push(callback);
    }

    private notifyAuthChange(): void {
        for (const callback of this.authChangeCallbacks) {
            callback();
        }
    }
}
