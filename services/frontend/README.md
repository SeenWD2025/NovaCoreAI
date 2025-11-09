# Noble NovaCoreAI - Frontend Application

React + TypeScript frontend for the Noble NovaCoreAI platform.

## Phase 10 Implementation - In Progress

This is the frontend implementation for the Noble NovaCoreAI platform, featuring:

- **Authentication**: Login, Register, Protected Routes
- **Dashboard**: Progress overview, quick access to lessons
- **NGS Curriculum**: 24-level learning portal (in development)
- **Chat Interface**: AI chat with memory context (in development)
- **Memory Visualization**: STM/ITM/LTM explorer (in development)
- **Progress Tracking**: Achievements, leaderboard, XP tracking

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Routing**: React Router v6
- **State Management**: Zustand
- **Styling**: Tailwind CSS v4
- **HTTP Client**: Axios
- **Code Editor**: Monaco Editor (for challenges)
- **Markdown**: react-markdown

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000/api
```

## Features Status

### Completed ✅
- [x] Project setup with Vite + React + TypeScript
- [x] Tailwind CSS configuration
- [x] Routing with React Router
- [x] Authentication pages (Login/Register)
- [x] Protected routes
- [x] API client with interceptors
- [x] Auth service and store
- [x] Curriculum service and store
- [x] Main layout with sidebar navigation
- [x] Dashboard page with progress overview
- [x] TypeScript types for all backend models

### In Progress 🚧
- [ ] Level Browser page
- [ ] Lesson Viewer with markdown rendering
- [ ] Challenge Playground with Monaco Editor
- [ ] Chat interface with WebSocket
- [ ] Memory visualization
- [ ] Progress Tracker
- [ ] Leaderboard
- [ ] Profile & Settings

## Known Issues

- Some pages are placeholders pending full implementation
- Challenge code execution requires backend sandbox integration
- Real-time WebSocket chat not yet implemented
