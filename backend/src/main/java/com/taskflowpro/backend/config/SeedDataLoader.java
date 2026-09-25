package com.taskflowpro.backend.config;

import com.taskflowpro.backend.domain.Task;
import com.taskflowpro.backend.engine.DependencyEngine;
import com.taskflowpro.backend.repository.TaskRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.UUID;

@Component
public class SeedDataLoader implements CommandLineRunner {

    private final TaskRepository taskRepository;
    private final DependencyEngine engine;

    public SeedDataLoader(TaskRepository taskRepository, DependencyEngine engine) {
        this.taskRepository = taskRepository;
        this.engine = engine;
    }

    @Override
    public void run(String... args) {
        if (taskRepository.count() > 0) {
            return;  }

        LocalDate start = LocalDate.now();

        Task dbSchema = save(new Task("Database schema design", "Design tables for tasks and dependencies", 2, start));
        Task backendApi = save(new Task("Backend API", "REST endpoints for tasks and dependencies", 3, start));
        Task frontendUi = save(new Task("Frontend UI", "Kanban board with drag and drop", 3, start));
        Task authSetup = save(new Task("Auth setup", "Basic user authentication", 2, start));
        Task integrationTests = save(new Task("Integration tests", "End to end API tests", 2, start));
        Task aiFeature = save(new Task("AI suggestion feature", "LLM based dependency suggestions", 2, start));
        Task criticalPath = save(new Task("Critical path view", "Highlight the longest dependency chain", 1, start));
        Task deployment = save(new Task("Deployment", "Docker compose and deployment docs", 1, start));
        Task readme = save(new Task("README and docs", "Setup guide and assumptions", 1, start));

         engine.addDependency(backendApi.getId(), dbSchema.getId());
        engine.addDependency(frontendUi.getId(), dbSchema.getId());
        engine.addDependency(integrationTests.getId(), backendApi.getId());
        engine.addDependency(integrationTests.getId(), frontendUi.getId());
        engine.addDependency(aiFeature.getId(), backendApi.getId());
        engine.addDependency(criticalPath.getId(), backendApi.getId());
        engine.addDependency(deployment.getId(), integrationTests.getId());
        engine.addDependency(deployment.getId(), aiFeature.getId());
        engine.addDependency(readme.getId(), deployment.getId());
    }

    private Task save(Task task) {
        return taskRepository.save(task);
    }
}
