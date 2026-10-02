# TaskFlow Pro

**A Kanban board that actually understands dependencies.**

🔗 **Live demo:** https://taskflow-pro-orpin-xi.vercel.app/
📦 **Backend API:** https://taskflow-pro-backend-knss.onrender.com

> The backend is hosted on Render's free tier, which sleeps after inactivity.
> The first request after a period of inactivity can take 30–60 seconds to
> wake up — if the board briefly shows placeholder/demo data on first load,
> please wait a moment and refresh. This is a deliberate offline-fallback
> feature (see `services/api.ts`), not a bug: the app degrades gracefully
> instead of crashing when the backend is slow or unreachable.

---

#### ***Designed for the \*\*Contata NCR Hackathon 2026\*\* (TaskFlow Pro problem statement).***



\---



#### **## Why this was made**



> "Integration tests can't run until the backend API and database schema are ready."



That one sentence from the problem statement is the challenge. A regular Kanban board has no idea that's true. TaskFlow Pro sees every project as a \*directed graph of tasks\*\* and fixes four things that a simple board gets wrong:



##### | Problem | What happens else | What TaskFlow Pro does



|---|---|---|



| Circular dependencies | Sometimes accepted or causes problems | Found and not saved |



| Delays that spread | Handled one card at a time | Happens automatically across the graph |



| \*\*Delays that meet\*\* | Often counted twice | Counted once. See below |



| Making work available | You have to remember to check | Updated automatically every time



\### The bug most solutions get wrong



Imagine two paths that both start at task \*\*A\*\*. Both lead to task \*\*D\*\*:



┌──► B ──┐



A ───┤ ├──► D



──► C ──┘



If \*\*A\*\* is delayed by 3 days both \*\*B\*\* and \*\*C\*\* are delayed by 3 days as well. Same reason, two results. The simple fix adds up every path into D: 3 days (from B). 3 Days (from C) = \*\*6 days\*\* which is not correct. TaskFlow Pro uses the finishing prerequisite, not the sum so \*\*D\*\* moves exactly \*\*3 days\*\*. Matching the real delay that happened.



This exact situation is tested in a test (`SchedulerTest.diamondDoesNotCompoundDelay`) and is tested against 50 randomly created graphs (`SchedulerRandomizedTest`) to ensure it works in general not just in one example.



\---



### **## Quick start**



\*\*Requirements:\*\* Java 21 · Node.js · Docker Desktop



```bash



\# 1. Database



docker compose up -d



\# 2. Backend. From backend/



cd backend



./mvnw spring-boot:run



\# → http://localhost:8080



\# 3. Frontend. From frontend/



cd frontend



npm install



npm run dev



### **# → http://localhost:5173**



```



Postgres runs on port `5433` (not the 5432`) to avoid conflicts with other local instances.



### **\*\*AI suggestions (optional):\*\* get a key at**



\[aistudio.google.com/apikey](https://aistudio.google.com/apikey) and set it



before starting the backend:



LLM\_API\_KEY=your\_key\_here



Everything else works without any setup. Without a key the app works the same. The AI panel just doesn't have any suggestions.



\---

### 

### **## How it works**



React frontend



│



▼



Spring Boot REST API



│



├──► Dependency engine ( Java · no web/DB dependencies · easy to test alone)



│ │



│ ▼



│ PostgreSQL (tasks · dependencies · AI suggestion audit trail)



│



──► AI suggestion service ──► Gemini API



│



▼



checked by the same cycle checker used for manual edits



\*\*The one choice that makes everything else simple:\*\* Blocked/Ready status is \*never saved\*. Its calculated every time from task statuses and the dependency graph. That single choice is why "rollback" needs no code at all. Move a Done task back to In Progress and every dependent task is simply Blocked again the next time anyone looks because that was always the case.



\### Engine details (`backend/.../engine/`)



\- \*\*`CycleChecker`\*\*. Before saving an edge walks the graph from the proposed prerequisite to see if it can already reach the task it would depend on. If it can the edge would create a loop so its rejected. Nothing is saved the current graph stays the same.



\- \*\*`Scheduler`\*\*. Processes tasks each in topological order. Each tasks start date is `max(its own start latest-finishing prerequisite + 1 day)`. Using a \*max\* of \*summing\* per incoming path is the main fix for the diamond problem above. The same topological pass also finds the \*critical path\*\*. The longest chain by duration.



\---



### **## Whats included**



| Feature | Where |



|---|---|



Cycle detection | `engine/CycleChecker.java` + `CycleCheckerTest` |



| Diamond-safe scheduling | `engine/Scheduler.java` + `SchedulerTest` `SchedulerRandomizedTest` |



| Automatic rollback | Derived status. See `RollbackTest.java` |



| AI dependency suggestions | `ai/AiSuggestionService.java`. Validated human-approved |



| Critical path | `GET /api/critical-path` |



| What-if preview | `POST /api/tasks/{id}/preview`. See the impact before making changes |



| Kanban board, drag \& drop | `frontend/src/components/` |



\---



### **## AI use. How its kept honest**



The AIs only job is \*\*suggesting\*\* dependencies. It never writes to the graph directly. Its output is never trusted without checking:



1\. Task titles/descriptions go to Gemini; it returns suggested prerequisite



IDs, a confidence level and a short reason as JSON.



2\. Every suggested ID is checked against tasks. Anything made up or



already linked is ignored.



3\. Every remaining suggestion runs through the same `CycleChecker` used



for manual edits. A suggestion that would create a loop never even



reaches the screen.



4\. Whats left is shown as \*\*pending\*\* with its reason and confidence



visible. \*\*Nothing becomes a dependency until a human clicks



Accept\*\*. And accepting goes through the same validated path as typing



it in by hand.



5\. If the API call fails, times out or returns data the feature



stops working without any problems. The apps correctness never depends



on the AI being available.



AI coding assistants used while building this project are listed in



\[`AI\_TOOL\_DECLARATION.md`](./AI\_TOOL\_DECLARATION.md).



\---



### **## Testing**



```bash



cd backend \&\&./mvnw test



```



| Test | Proves |



|---|---|



CycleCheckerTest` | Direct loops, long loops, self-dependency all rejected. A diamond shape is \*not\* mistaken for one |



| `SchedulerTest` | A simple chain moves delays correctly; the diamond case moves by exactly one delay, not two |



| `RollbackTest` | Undoing a Done status re-blocks dependents with no dedicated rollback code |



| `SchedulerRandomizedTest` | 50 randomly generated DAGs (4–11 tasks each) all agree between the real scheduler and an independent naive recomputation from scratch |



That last test is the one I would point to first. It's not "this one example



works " it's "this holds across fifty structurally different graphs I never



hand-picked."



\---



### **## Key assumptions and limits**



\- Only calendar days. No weekends or holidays



\- Single project/board no multiple users



\- A Done task keeps its dates even if later changes affect other tasks



\- No authentication. Not part of a 72-hour sprint



\- AI suggestions look only at task titles/descriptions, not wider context



\- CORS is open (`allowedOriginPatterns("\*")`) for local dev



convenience. Should be limited to real origins before any deployment

### 

### **## API details**



| Method | Path | Purpose |



|---|---|---|



GET | `/api/tasks` | Show all tasks with live-computed status |



POST | `/api/tasks` | Create a task |



| PATCH | `/api/tasks/{id}` | Update status or board position |



| POST | `/api/tasks/{id}/preview` | Preview a changes impact without saving |



| POST | `/api/dependencies` | Add a dependency (409 if it would create a cycle) |



| DELETE | `/api/dependencies/{id}` | Remove a dependency by its own id |



DELETE | `/api/dependencies?taskId=\&prerequisiteId=` | Remove by task/prerequisite pair |



POST | `/api/tasks/{id}/suggestions` | Get AI suggestions for a task |



| POST | `/api/suggestions/{id}/accept` | Accept a suggestion → real dependency |



| POST | `/api/suggestions/{id}/reject` | Delete a suggestion |



| GET | `/api/path` | The longest chain of dependencies, in the project |

