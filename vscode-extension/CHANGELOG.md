# Change Log

All notable changes to the "noble-novacore-vscode" extension will be documented in this file.

## [0.1.0] - 2025-11-09

### Added
- Initial release of Noble NovaCoreAI VSCode extension
- Email/password authentication
- Context fetching for active files
- Task submission to AI assistant
- Automatic memory logging on file save
- Context view sidebar
- Memories view sidebar
- Status bar integration
- Configuration settings for API URL and auto-features
- Commands for authentication, context fetching, and task submission

### Features
- **Persistent Memory Context**: Fetches relevant memories when opening files
- **AI Task Assistance**: Submit coding tasks with full context
- **Automatic Logging**: Tracks code changes and successful patterns
- **Context Visualization**: Shows memory tiers and confidence scores
- **Seamless Integration**: Works in background with minimal UI interruption

### Known Limitations
- OAuth device code flow not yet implemented (planned for 0.2.0)
- WebSocket streaming not yet supported (planned for 0.2.0)
- No inline suggestions yet (planned for 0.3.0)

### Architecture
- Built with TypeScript 5.3
- Uses Axios for HTTP requests
- Integrates with NovaCoreAI MCP Server (port 7000)
- Supports VSCode 1.85+

## [Unreleased]

### Planned for 0.2.0
- OAuth device code flow for authentication
- WebSocket support for streaming responses
- Improved error handling and retry logic
- Memory caching for offline access
- Better context visualization

### Planned for 0.3.0
- Inline code suggestions
- Multi-file context awareness
- Custom memory tagging
- Memory visualization graphs
- Team collaboration features
