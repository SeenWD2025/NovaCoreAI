import axios, { AxiosInstance } from 'axios';
import { AuthManager } from './auth';

export interface MemoryItem {
    id: string;
    content: string;
    tier: string;
    confidence_score: number;
    created_at: string;
}

export interface ContextResponse {
    memories: MemoryItem[];
    context_summary: string;
}

export interface TaskResponse {
    session_id: string;
    response: string;
    tokens_used?: number;
}

export class McpClient {
    private authManager: AuthManager;
    private client: AxiosInstance;

    constructor(authManager: AuthManager) {
        this.authManager = authManager;
        this.client = axios.create({
            baseURL: authManager.getApiUrl()
        });

        // Add request interceptor to include auth token
        this.client.interceptors.request.use(async (config) => {
            const token = await this.authManager.getAccessToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
    }

    async fetchContext(
        filePath: string,
        fileContent?: string,
        language?: string,
        limit?: number
    ): Promise<ContextResponse> {
        const response = await this.client.post('/api/mcp/context/fetch', {
            file_path: filePath,
            file_content: fileContent,
            language,
            limit: limit || 5
        });

        return response.data;
    }

    async logMemory(
        filePath: string,
        action: string,
        content?: string,
        outcome?: string,
        metadata?: any
    ): Promise<void> {
        await this.client.post('/api/mcp/memory/log', {
            file_path: filePath,
            action,
            content,
            outcome,
            metadata
        });
    }

    async submitTask(
        taskDescription: string,
        fileContext?: string,
        sessionId?: string
    ): Promise<TaskResponse> {
        const response = await this.client.post('/api/mcp/task/submit', {
            task_description: taskDescription,
            file_context: fileContext,
            session_id: sessionId
        });

        return response.data;
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.client.get('/api/mcp/health');
            return response.data.status === 'healthy';
        } catch (error) {
            return false;
        }
    }
}
