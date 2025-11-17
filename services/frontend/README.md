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

### Fully Implemented ✅
- [x] Project setup with Vite + React + TypeScript
- [x] Tailwind CSS configuration
- [x] Routing with React Router
- [x] Authentication pages (Login/Register/Email Verification)
- [x] Protected routes with auth guards
- [x] API client with interceptors and token refresh
- [x] Auth service and store (Zustand)
- [x] Curriculum service and store (Zustand)
- [x] Main layout with sidebar navigation
- [x] Dashboard page with progress overview
- [x] Level Browser page (24 levels)
- [x] Lesson Viewer with markdown rendering
- [x] Progress Tracker with XP and achievements
- [x] Leaderboard with rankings
- [x] Profile & Settings page
- [x] Usage quota display
- [x] Note Builder (create/edit structured notes)
- [x] Study interface (study sessions)
- [x] Quiz Taker (quiz generation and grading)
- [x] Memory Visualization (STM/ITM/LTM explorer)
- [x] TypeScript types for all backend models

### Partially Implemented 🚧
- [ ] Challenge Playground - Monaco Editor integrated but code execution requires backend sandbox service
- [ ] Chat interface - UI complete but WebSocket streaming needs production testing
- [ ] Real-time notifications - Infrastructure ready but not fully integrated

### Not Yet Implemented ❌
- [ ] Admin dashboard for user management
- [ ] Analytics and insights page
- [ ] Mobile responsive optimizations for all pages
- [ ] Dark mode theme toggle
- [ ] Accessibility (ARIA labels, keyboard navigation)

## Known Issues

- Challenge code execution requires backend sandbox integration (security concern)
- WebSocket chat streaming works in development but needs production load testing
- Some pages may need responsive design improvements for mobile devices
- Memory visualization performance may degrade with large datasets
