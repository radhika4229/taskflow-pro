# TaskFlow Pro — Frontend

A Kanban board backed by a topological dependency graph (DAG) engine built for hackathons.

## Features
- **Computed Blocked vs Ready**: Cards compute their blocked/ready state directly from prerequisite completion—never manually toggled.
- **Drag & Drop with Blocked Protection**: Powered by `@hello-pangea/dnd`. Blocked cards cannot be dragged to *In Progress*, *Review*, or *Done*—the system halts the action and displays an inline explanation with the exact blocking prerequisites.
- **Cycle Conflict Handling**: When adding a dependency that would form a cycle (e.g. A → B → C → A), the server returns `409 Conflict`, which is rendered as a prominent, human-readable inline warning.
- **Schedule Propagation & Reconvergence**: Schedule changes propagate through the graph without double counting reconvergent paths (diamond problem).
- **Rollback Reactivity**: Moving a completed task back to *In Progress* immediately re-blocks downstream dependents.
- **AI Dependency Assistant (Human-in-the-Loop)**: Recommends likely prerequisites with confidence scores and reasoning; strictly requires explicit user acceptance.
- **4 Live Summary Stat Cards**: Total, In Progress, Blocked, Done computed client-side.
- **Warm Editorial Aesthetic**: Warm cream background (`#FAF7F2`), terracotta accent (`#D97748`), Fraunces serif display headings, Inter sans-serif body, and text-only status badges.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the Vite development server
npm run dev
```

The app will start at `http://localhost:3000` and proxy all `/api/*` calls to the Spring Boot backend running at `http://localhost:8080`.
