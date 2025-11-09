# Frontend Integration Specification - NGS Curriculum

**Version:** 1.0  
**Target:** Phase 10 Frontend Development  
**Last Updated:** November 9, 2025

---

## Overview

This document provides comprehensive specifications for integrating the NGS Curriculum backend with the Phase 10 frontend, creating a DataCamp/Coursera-style learning portal with VSCode/Replit-style IDE and playground features.

---

## Architecture Overview

### Frontend Components

```
services/frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx          # Main user dashboard
│   │   ├── LevelBrowser.tsx       # Browse all 24 levels
│   │   ├── LessonViewer.tsx       # View lesson content
│   │   ├── PracticeZone.tsx       # Complete human practices
│   │   ├── ReflectionEditor.tsx   # Submit reflections
│   │   ├── ChallengePlayground.tsx # Coding challenges
│   │   ├── ProgressTracker.tsx    # Visualize journey
│   │   └── Leaderboard.tsx        # Community rankings
│   ├── components/
│   │   ├── ProgressBar.tsx        # XP and level progress
│   │   ├── LessonCard.tsx         # Lesson preview card
│   │   ├── AchievementBadge.tsx   # Achievement display
│   │   ├── MarkdownRenderer.tsx   # Render lesson markdown
│   │   ├── CodeEditor.tsx         # Monaco/CodeMirror integration
│   │   └── ReflectionPrompt.tsx   # Reflection UI component
│   ├── services/
│   │   ├── api.ts                 # API client
│   │   ├── auth.ts                # Authentication
│   │   └── curriculum.ts          # Curriculum API wrapper
│   └── types/
│       └── curriculum.ts          # TypeScript types
```

---

## API Integration

### Base Configuration

```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Curriculum Service

```typescript
// src/services/curriculum.ts
import api from './api';
import { 
  UserProgress, 
  CurriculumLevel, 
  Lesson, 
  LessonCompletion,
  Reflection,
  Challenge 
} from '@/types/curriculum';

export const curriculumService = {
  // Progress
  getProgress: () => api.get<UserProgress>('/ngs/progress'),
  
  // Levels
  getLevels: () => api.get<{ levels: CurriculumLevel[], count: number }>('/ngs/levels'),
  getLevel: (level: number) => api.get<CurriculumLevel>(`/ngs/levels/${level}`),
  
  // Lessons
  getLessonsByLevel: (level: number) => 
    api.get<{ lessons: Lesson[], count: number }>(`/ngs/levels/${level}/lessons`),
  getLesson: (lessonId: string) => api.get<Lesson>(`/ngs/lessons/${lessonId}`),
  completeLesson: (lessonId: string, data: {
    score?: number;
    time_spent_seconds?: number;
    reflection_text?: string;
    metadata?: any;
  }) => api.post<{ completion: LessonCompletion }>(`/ngs/lessons/${lessonId}/complete`, data),
  
  // Reflections
  getReflections: (limit: number = 20) => 
    api.get<{ reflections: Reflection[], count: number }>(`/ngs/reflections?limit=${limit}`),
  submitReflection: (data: {
    lesson_id?: string;
    level_number?: number;
    reflection_prompt: string;
    reflection_text: string;
    is_public?: boolean;
  }) => api.post<{ reflection: Reflection }>('/ngs/reflections', data),
  
  // Challenges
  getChallengesByLevel: (level: number) =>
    api.get<{ challenges: Challenge[], count: number }>(`/ngs/levels/${level}/challenges`),
  getChallenge: (challengeId: string) => api.get<Challenge>(`/ngs/challenges/${challengeId}`),
  submitChallenge: (challengeId: string, code: string) =>
    api.post(`/ngs/challenges/${challengeId}/submit`, { submission_code: code }),
  
  // XP & Achievements
  awardXP: (source: string, amount?: number, metadata?: any) =>
    api.post('/ngs/award-xp', { source, amount, metadata }),
  getAchievements: () => api.get('/ngs/achievements'),
  getLeaderboard: (limit: number = 10) => 
    api.get(`/ngs/leaderboard?limit=${limit}`)
};
```

---

## TypeScript Types

```typescript
// src/types/curriculum.ts

export interface UserProgress {
  id: string;
  user_id: string;
  current_level: number;
  total_xp: number;
  agent_creation_unlocked: boolean;
  current_level_info?: CurriculumLevel;
  next_level_info?: CurriculumLevel;
  xp_to_next_level: number;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface CurriculumLevel {
  id: number;
  level_number: number;
  title: string;
  description: string;
  unlock_requirements?: any;
  xp_required: number;
}

export interface Lesson {
  id: string;
  level_id: number;
  title: string;
  description: string;
  lesson_order: number;
  lesson_type: 'tutorial' | 'exercise' | 'quiz' | 'challenge' | 'reflection';
  content_markdown?: string;
  core_lesson: string;
  human_practice: string;
  reflection_prompt: string;
  agent_unlock: string;
  xp_reward: number;
  estimated_minutes: number;
  prerequisites?: any;
  metadata?: any;
  is_required: boolean;
  completed?: boolean;
  completed_at?: string;
  user_score?: number;
  created_at: string;
  updated_at: string;
}

export interface LessonCompletion {
  id: string;
  user_id: string;
  lesson_id: string;
  score?: number;
  time_spent_seconds?: number;
  reflection_text?: string;
  completion_data?: any;
  completed_at: string;
}

export interface Reflection {
  id: string;
  user_id: string;
  lesson_id?: string;
  level_number?: number;
  reflection_prompt: string;
  reflection_text: string;
  quality_score?: number;
  xp_awarded: number;
  is_public: boolean;
  created_at: string;
}

export interface Challenge {
  id: string;
  lesson_id?: string;
  level_id: number;
  title: string;
  description: string;
  challenge_type: 'coding' | 'design' | 'reflection' | 'collaboration';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  starter_code?: string;
  test_cases?: any;
  solution_template?: string;
  xp_reward: number;
  time_limit_minutes?: number;
  tags?: string[];
  metadata?: any;
  is_active: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_data: any;
  unlocked_at: string;
}
```

---

## Page Specifications

### 1. Dashboard

**Route:** `/dashboard`

**Features:**
- Current level and XP display with animated progress bar
- Next level preview with XP needed
- Quick access to current level lessons
- Recent reflections
- Achievement highlights
- Daily streak counter
- Leaderboard position

**Key Components:**
```tsx
<ProgressBar current={progress.total_xp} max={progress.next_level_info.xp_required} />
<LevelCard level={progress.current_level_info} />
<RecentLessons lessons={recentLessons} />
<AchievementStrip achievements={recentAchievements} />
```

### 2. Level Browser

**Route:** `/levels`

**Features:**
- Grid or list view of all 24 levels
- Locked/unlocked states with visual indicators
- Phase grouping (Initiation, Construction, Integration, Ascension)
- XP requirements and level descriptions
- Click to view level lessons

**Visual Design:**
- Locked levels: Greyed out with lock icon
- Current level: Highlighted with progress ring
- Completed levels: Green checkmark
- Level 12: Special "Agent Creation" badge

### 3. Lesson Viewer

**Route:** `/lessons/:id`

**Features:**
- Markdown-rendered lesson content
- Core lesson display
- Human practice instructions
- Reflection prompt
- Agent unlock information
- Estimated time
- Navigation: Previous/Next lesson
- Complete lesson button

**Layout:**
```
┌─────────────────────────────────────┐
│ [Level N] Lesson Title              │
│ ⏱ 45 min  🎯 50 XP                  │
├─────────────────────────────────────┤
│                                     │
│ Lesson Content (Markdown)           │
│                                     │
├─────────────────────────────────────┤
│ 📚 Core Lesson                      │
│ [Core lesson text]                  │
│                                     │
│ 🏃 Human Practice                   │
│ [Practice instructions]             │
│                                     │
│ 💭 Reflection Prompt                │
│ [Reflection question]               │
│                                     │
│ 🤖 Agent Unlock                     │
│ [Agent feature unlocked]            │
├─────────────────────────────────────┤
│ [Previous] [Mark Complete] [Next]   │
└─────────────────────────────────────┘
```

### 4. Practice Zone

**Route:** `/practice/:lessonId`

**Features:**
- Practice instructions display
- Timer for practice duration
- Notes/journal area
- Submit reflection button
- Links to related resources

### 5. Reflection Editor

**Component/Modal**

**Features:**
- Rich text editor (Markdown support)
- Character count display
- Reflection prompt display
- Quality hints (aim for 150+ characters)
- Save as draft
- Submit and earn XP
- Previous reflections sidebar

**UI Pattern:**
```tsx
<ReflectionEditor
  prompt="What signals are truly yours?"
  onSubmit={handleSubmit}
  minLength={50}
  qualityFeedback={true}
/>
```

### 6. Challenge Playground

**Route:** `/challenges/:id`

**Features:**
- Split-pane layout: Instructions | Code Editor | Output
- Monaco Editor or CodeMirror integration
- Language selection
- Run tests button
- Submit solution button
- Test case results display
- Hints system
- Time tracking

**Layout:**
```
┌───────────────┬──────────────────┬──────────────┐
│ Instructions  │ Code Editor      │ Test Results │
│               │                  │              │
│ - Description │ [Monaco Editor]  │ ✓ Test 1     │
│ - Test Cases  │                  │ ✓ Test 2     │
│ - Hints       │ [Run] [Submit]   │ ✗ Test 3     │
└───────────────┴──────────────────┴──────────────┘
```

### 7. Progress Tracker

**Route:** `/progress`

**Features:**
- Visual journey map (all 24 levels)
- XP history chart
- Lessons completed count
- Reflections submitted count
- Challenges solved count
- Time spent learning
- Export progress report

### 8. Leaderboard

**Route:** `/leaderboard`

**Features:**
- Global rankings by XP
- User's position highlight
- Filter options (friends, cohort)
- Top performers showcase
- Weekly/monthly/all-time views

---

## UI/UX Guidelines

### Visual Theme

- **Primary Color:** Deep blue (#1e3a8a) - Wisdom, depth
- **Secondary Color:** Gold (#fbbf24) - Achievement, growth
- **Accent Color:** Teal (#14b8a6) - Reflection, clarity
- **Background:** Light gradient (#f9fafb to #e5e7eb)

### Typography

- **Headings:** Inter or Poppins
- **Body:** System font stack or Inter
- **Code:** Fira Code or JetBrains Mono

### Icons

- Use Heroicons or Lucide for consistency
- Custom icons for levels and achievements

### Animations

- Smooth transitions (300ms ease)
- Progress bars with animation
- Level unlock celebrations
- XP gain notifications (toast)

---

## Responsive Design

### Breakpoints

```css
/* Mobile */
@media (max-width: 640px) { ... }

/* Tablet */
@media (min-width: 641px) and (max-width: 1024px) { ... }

/* Desktop */
@media (min-width: 1025px) { ... }
```

### Mobile Adaptations

- Stack lesson content vertically
- Collapsible sidebar
- Bottom navigation for main sections
- Simplified challenge editor (full screen)

---

## State Management

### Recommended: Zustand or React Context

```typescript
// src/stores/curriculumStore.ts
import create from 'zustand';

interface CurriculumState {
  progress: UserProgress | null;
  levels: CurriculumLevel[];
  currentLesson: Lesson | null;
  
  fetchProgress: () => Promise<void>;
  fetchLevels: () => Promise<void>;
  setCurrentLesson: (lesson: Lesson) => void;
}

export const useCurriculumStore = create<CurriculumState>((set) => ({
  progress: null,
  levels: [],
  currentLesson: null,
  
  fetchProgress: async () => {
    const { data } = await curriculumService.getProgress();
    set({ progress: data });
  },
  
  fetchLevels: async () => {
    const { data } = await curriculumService.getLevels();
    set({ levels: data.levels });
  },
  
  setCurrentLesson: (lesson) => set({ currentLesson: lesson })
}));
```

---

## Code Editor Integration

### Monaco Editor (VSCode-like)

```bash
npm install @monaco-editor/react
```

```tsx
import Editor from '@monaco-editor/react';

<Editor
  height="600px"
  language="javascript"
  theme="vs-dark"
  value={code}
  onChange={setCode}
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    automaticLayout: true
  }}
/>
```

### Markdown Rendering

```bash
npm install react-markdown remark-gfm
```

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {lessonContent}
</ReactMarkdown>
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/components/LessonCard.test.tsx
import { render, screen } from '@testing-library/react';
import { LessonCard } from '@/components/LessonCard';

test('renders lesson card with completion status', () => {
  const lesson = { ... };
  render(<LessonCard lesson={lesson} />);
  expect(screen.getByText(lesson.title)).toBeInTheDocument();
});
```

### Integration Tests

- Test full lesson completion flow
- Test XP calculation and level progression
- Test reflection submission

### E2E Tests (Playwright/Cypress)

- User journey through Level 1
- Complete lesson and earn XP
- Submit reflection
- View progress update

---

## Performance Optimization

1. **Code Splitting**
   - Lazy load lesson content
   - Lazy load code editor

2. **Caching**
   - Cache curriculum levels (static)
   - Cache user progress (revalidate on action)

3. **Optimistic Updates**
   - Update UI immediately on XP award
   - Show loading states for async operations

4. **Bundle Size**
   - Tree-shake unused dependencies
   - Use dynamic imports for heavy components

---

## Accessibility (WCAG 2.1 AA)

- Keyboard navigation support
- ARIA labels for interactive elements
- High contrast mode
- Screen reader friendly
- Focus management
- Skip links

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Authentication flow working
- [ ] Error boundaries implemented
- [ ] Loading states for all async operations
- [ ] 404 and error pages
- [ ] SEO meta tags
- [ ] Analytics integration
- [ ] Performance monitoring

---

## Future Enhancements (Post-MVP)

1. **Collaborative Features**
   - Study groups
   - Peer code reviews
   - Shared reflections

2. **Gamification**
   - Daily challenges
   - Streak bonuses
   - Special events

3. **Content**
   - Video lessons
   - Interactive tutorials
   - Downloadable resources

4. **Social**
   - Discussion forums
   - Mentor matching
   - Community showcases

---

**Status:** ✅ Ready for Phase 10 Implementation  
**Estimated Development Time:** 4-6 weeks  
**Priority:** High - Critical for user engagement
