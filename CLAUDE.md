# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **AI-powered customer service agent** (智能客服) built with React + Express + TypeScript. It integrates the @tencent-ai/agent-sdk for AI chat, maintains a FAQ knowledge base, and provides business data integration (orders, refunds, users) with an admin dashboard.

## Commands

```bash
# Development (concurrently starts both server on :3000 and client on :5173)
npm run dev

# Start server only
npm run dev:server

# Start client only (Vite dev server)
npm run dev:client

# Build for production (TypeScript check + Vite build)
npm run build

# Run production server
npm run server
```

There are no test scripts configured. The project does not use any test framework.

## Architecture

### Stack
- **Frontend**: React 18 + TypeScript + Vite + TDesign React UI + Tailwind CSS
- **Backend**: Express + TypeScript (run via `tsx`)
- **AI SDK**: @tencent-ai/agent-sdk (provides `query()`, `unstable_v2_createSession()`, `unstable_v2_authenticate()`)
- **Database**: SQLite via `sql.js` (WASM-compiled SQLite — runs in-process, no native dependency)
- **Streaming**: Server-Sent Events (SSE) for real-time chat responses

### Directory Structure

```
├── server/
│   ├── index.ts       # Express server: API routes, chat SSE handler, AI SDK integration
│   ├── db.ts          # SQLite database: schema, CRUD for all tables, seed data
│   ├── faq.ts         # FAQ knowledge base (~40 questions across 4 categories)
│   └── index.d.ts     # Type declarations
├── src/
│   ├── main.tsx       # React entry point (BrowserRouter + App)
│   ├── App.tsx        # Root layout: Sidebar + Header + page routing
│   ├── config.ts      # App config (name, intents)
│   ├── types.ts       # All TypeScript interfaces (Session, Message, ToolCall, UserInfo, etc.)
│   ├── index.css      # Tailwind + TDesign CSS variable overrides for dark/light themes
│   ├── pages/
│   │   └── ChatPage.tsx  # Main chat page (messages view + input)
│   ├── hooks/
│   │   ├── useChat.ts     # Chat logic: sendMessage, SSE stream parsing, permission flow
│   │   ├── useSessions.ts # Session CRUD from API
│   │   ├── useModels.ts   # Model list from API
│   │   ├── useAgents.ts   # Custom agent configs (localStorage)
│   │   ├── useTheme.ts    # Light/dark theme toggle
│   │   └── useUser.ts     # User auth (register/login) state
│   └── components/
│       ├── Sidebar.tsx, Header.tsx          # Layout components
│       ├── ChatMessages.tsx                  # Message rendering with ChatMarkdown
│       ├── ChatInput.tsx                     # Input with model/permission selectors
│       ├── NewChatView.tsx                   # Landing view with quick questions
│       ├── PermissionDialog.tsx              # Tool-use permission confirmation
│       ├── InlinePermissionCard.tsx          # Inline permission UI in chat
│       ├── ToolCallsCollapse.tsx             # Expandable tool call display
│       ├── AgentConfigDialog.tsx             # Custom agent editor
│       ├── LoginDialog.tsx                   # Phone-based login/register
│       ├── SatisfactionRating.tsx            # Post-chat rating (1-5 stars)
│       ├── IntentTag.tsx                     # Intent badge/label
│       ├── TransferToHuman.tsx               # "Transferred to human" indicator
│       ├── SettingsPage.tsx                  # Custom agent management
│       └── AdminPage.tsx                     # Admin dashboard with stats
├── data/chat.db         # SQLite database file (auto-created on first run)
├── .env                 # Environment config (CODEBUDDY_API_KEY, PORT)
└── package.json
```

### Database Schema (SQLite via sql.js)

7 tables managed in `server/db.ts`:

| Table | Purpose |
|---|---|
| `sessions` | Chat sessions with intent tracking, satisfaction rating, human transfer flag |
| `messages` | Per-session messages (user/assistant roles, tool_calls in JSON) |
| `satisfaction_ratings` | 1-5 star ratings with optional comments |
| `users` | Customer info (name, phone, email, vip_level) |
| `orders` | Customer orders with status tracking |
| `refunds` | Refund requests linked to orders |
| `user_memory` | Cross-session memory (summary/preference/fact types) |

The DB auto-seeds a test user "舒珺琦" (VIP2) with 6 sample orders and 2 refund records on first run.

### Chat Flow (server/index.ts POST /api/chat)

The chat endpoint processes messages through a **4-step pipeline**:

1. **Intent detection** (`detectIntent()` in faq.ts) — classifies message as `refund`, `order_query`, `tech_support`, or `general`
2. **Human transfer check** (`shouldTransferToHuman()`) — based on keywords, conversation length, and sentiment heuristics
3. **Business data short-circuit** — if the user provides a userId and intent matches `order_query` or `refund`, the server directly queries the database and returns structured order/refund data without invoking AI
4. **FAQ knowledge base lookup** — if the message matches FAQ entries (by intent + keyword scoring), return the canned answer with personalized user data injected
5. **AI SDK fallback** — if no FAQ matches, calls `@tencent-ai/agent-sdk`'s `query()` with a system prompt containing user context (name, VIP level, orders, memories, etc.)

### SSE Event Types

The server streams these event types to the client:

| Event type | Purpose |
|---|---|
| `init` | Session creation, model info |
| `text` | Streaming text content |
| `tool` | Tool call started |
| `tool_result` | Tool call completed/errored |
| `permission_request` | Tool-use permission prompt |
| `done` | Response complete (with duration/cost) |
| `error` | Error message |
| `transfer_to_human` | Flags human agent handoff |
| `intent_detected` | Identified intent category |

### Permission System

4 modes for tool-use authorization (`src/types.ts`):
- `default` — asks for every tool call
- `acceptEdits` — auto-approves edit operations
- `plan` — read-only (plan mode)
- `bypassPermissions` — auto-approves everything

Permissions flow: server sends `permission_request` SSE → `useChat.ts` shows `InlinePermissionCard` → user approves/denies → `POST /api/permission-response` resolves the pending promise on the server.

### Key Dependencies

- **@tencent-ai/agent-sdk** — AI agent SDK for chat, session, and auth APIs
- **@tdesign-react/chat** — Prebuilt chat UI components (ChatSender, ChatMarkdown)
- **tdesign-react** — TDesign component library
- **sql.js** — SQLite compiled to WebAssembly (in-process, no native binaries needed)
- **lucide-react** — Lightweight icons
- **tdesign-icons-react** — TDesign icon set

### Vite Proxy

During development, the Vite dev server proxies `/api/*` requests to `http://localhost:3000` (configured in `vite.config.ts`).

### Environment Variables

```
CODEBUDDY_API_KEY=     # Required for AI SDK
CODEBUDDY_AUTH_TOKEN=  # Alternative auth
CODEBUDDY_BASE_URL=    # Custom API base URL
CODEBUDDY_INTERNET_ENVIRONMENT=external  # Network config
PORT=3000              # Server port
```
