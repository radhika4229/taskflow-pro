### \# AI Tool Declaration



This project used AI assistance during planning and development as disclosed below in accordance with the hackathons AI/LLM usage rules.



\## AI tools used to build this project



##### \*\*Claude (Anthropic)\*\*



Used during development for:



\- architecture and implementation planning



\- implementation and review of the dependency engine,



\- writing and reviewing backend Java code



\- debugging Spring Boot 4 / Jackson 3 migration issues and



\- drafting and refining documentation.



The generated code was. Understood before being committed.



##### \*\*Antigravity\*\*



Used to assist with building the frontend (React + TypeScript) including:



\- the Kanban board,



\- drag-and-drop interactions,



\- the task detail panel,



\- dependency management UI and



\- the AI suggestion panel.



The generated frontend code was. Adjusted to match the backend REST API contract.



\## AI used as a product feature (not a build tool)



##### \*\*Google Gemini (gemini-2.0-flash)\*\*



Gemini is not used to build or develop TaskFlow Pro. It is a runtime feature of the application.



TaskFlow Pro calls the Gemini API to suggest task dependencies. These suggestions are validated before being shown or accepted including checks that:



\- suggested task IDs correspond to tasks



\- duplicate dependencies are not introduced and



\- a suggestion does not create a dependency cycle.



A human must explicitly accept a suggestion before it becomes a dependency in the project. Further details are documented in the README under AI Usage.



\## Human-designed core logic



The core dependency-management strategy and scheduling approach were designed and validated by me. This includes:



\- cycle detection using graph reachability and



\- topological max-based scheduling to prevent delay compounding.



Claude was used as an implementation, testing, debugging and review collaborator for this logic. The underlying problem-solving approach was developed by me. I can explain the implementation and reasoning behind `CycleChecker.java` and `Scheduler.java` line, by line.

