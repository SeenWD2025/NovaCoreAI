# Noble NovaCoreAI - VSCode Extension

AI-powered code assistance with persistent memory and context awareness.

## Features

### 🧠 Persistent Memory Context
- Automatically fetches relevant memories when opening files
- Context-aware suggestions based on your coding history
- Semantic search through your past code interactions

### 💬 AI Task Assistance
- Submit coding tasks directly from VSCode
- Get AI responses with full memory context
- Maintain conversation history across sessions

### 📝 Automatic Memory Logging
- Logs code edits and saves automatically
- Tracks successful patterns and outcomes
- Builds knowledge over time

### 🔍 Context Visualization
- Sidebar view showing relevant memories
- See confidence scores and memory tiers (STM/ITM/LTM)
- Quick access to historical context

## Installation

### From Marketplace (Coming Soon)
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Noble NovaCoreAI"
4. Click Install

### From Source
1. Clone the repository
2. Navigate to `vscode-extension/`
3. Run `npm install`
4. Run `npm run compile`
5. Press F5 to launch extension in development mode

## Setup

### 1. Configure API URL
Set the NovaCoreAI API Gateway URL in settings:

```json
{
  "novacore.apiUrl": "http://localhost:5000"
}
```

For production, use your deployed API URL:
```json
{
  "novacore.apiUrl": "https://api.novacore.ai"
}
```

### 2. Authenticate
1. Open Command Palette (Ctrl+Shift+P)
2. Run "NovaCoreAI: Authenticate"
3. Choose Login or Register
4. Enter your credentials

### 3. Start Coding!
Once authenticated, the extension will:
- Automatically fetch context when you open files
- Log your code changes to memory
- Provide AI assistance on demand

## Commands

| Command | Description |
|---------|-------------|
| `NovaCoreAI: Authenticate` | Login or register with NovaCoreAI |
| `NovaCoreAI: Logout` | Logout from NovaCoreAI |
| `NovaCoreAI: Fetch Context` | Manually fetch context for current file |
| `NovaCoreAI: Submit Task` | Submit a task to the AI assistant |
| `NovaCoreAI: Show Memories` | Refresh the memories view |

## Configuration

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `novacore.apiUrl` | `http://localhost:5000` | NovaCoreAI API Gateway URL |
| `novacore.autoFetchContext` | `true` | Automatically fetch context when opening files |
| `novacore.autoLogChanges` | `true` | Automatically log code changes to memory |

### Example Configuration

```json
{
  "novacore.apiUrl": "http://localhost:5000",
  "novacore.autoFetchContext": true,
  "novacore.autoLogChanges": true
}
```

## Usage

### Fetching Context
1. Open any code file
2. Context is automatically fetched (if enabled)
3. View results in the "File Context" sidebar
4. Click on memories to see full content

### Submitting Tasks
1. Open Command Palette (Ctrl+Shift+P)
2. Run "NovaCoreAI: Submit Task"
3. Enter your task description
4. AI response opens in a new document

### Viewing Memories
1. Click on the NovaCoreAI icon in the activity bar
2. View "File Context" for current file
3. View "Recent Memories" for your history

## Architecture

```
┌──────────────────┐
│ VSCode Extension │
└────────┬─────────┘
         │ REST API
         ▼
┌─────────────────┐
│   API Gateway   │
│   (Port 5000)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MCP Server    │
│   (Port 7000)   │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌─────────┐ ┌──────────────┐
│ Memory  │ │ Intelligence │
│ Service │ │    Core      │
└─────────┘ └──────────────┘
```

## Development

### Prerequisites
- Node.js 18+
- VSCode 1.85+
- TypeScript 5.3+

### Build
```bash
npm install
npm run compile
```

### Run in Development
```bash
# Open in VSCode
code .

# Press F5 to launch extension host
```

### Package Extension
```bash
npm install -g @vscode/vsce
npm run package
```

This creates a `.vsix` file you can install locally or publish.

## Troubleshooting

### "Authentication failed"
- Check that the API Gateway is running
- Verify `novacore.apiUrl` is correct
- Try registering a new account

### "Failed to fetch context"
- Ensure MCP Server is running (port 7000)
- Check that you're authenticated
- Verify network connectivity

### "Memory not being logged"
- Check `novacore.autoLogChanges` is enabled
- Ensure you're authenticated
- Save files to trigger logging

## Security

- Credentials are stored in VSCode's secure secret storage
- All API calls use JWT authentication
- Tokens are automatically refreshed
- No sensitive data is logged locally

## Contributing

Contributions are welcome! Please see the main repository for contribution guidelines.

## License

MIT

## Support

- GitHub Issues: https://github.com/SeenWD2025/NovaCoreAI/issues
- Documentation: See main repository README

## Roadmap

- [ ] OAuth device code flow
- [ ] WebSocket support for streaming responses
- [ ] Inline code suggestions
- [ ] Multi-file context awareness
- [ ] Custom memory tagging
- [ ] Memory visualization graphs
- [ ] Export/import memories
- [ ] Team collaboration features

## Version History

### 0.1.0 (Initial Release)
- Basic authentication (email/password)
- Context fetching for files
- Task submission to AI
- Automatic memory logging
- Sidebar views for context and memories
- Status bar integration
