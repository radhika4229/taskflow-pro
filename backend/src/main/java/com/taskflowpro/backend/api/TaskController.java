package com.taskflowpro.backend.api;

import com.taskflowpro.backend.api.dto.*;
import com.taskflowpro.backend.domain.*;
import com.taskflowpro.backend.engine.DependencyEngine;
import com.taskflowpro.backend.repository.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;
    private final DependencyEngine engine;

    public TaskController(TaskRepository taskRepository, DependencyRepository dependencyRepository, DependencyEngine engine) {
        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;
        this.engine = engine;
    }

    @GetMapping
    public List<TaskResponse> listTasks() {
        List<Task> tasks = taskRepository.findAll();
        Map<UUID, Task> tasksById = tasks.stream().collect(Collectors.toMap(Task::getId, t -> t));
        Map<UUID, Set<UUID>> edges = new HashMap<>();
        for (Dependency dep : dependencyRepository.findAll()) {
            edges.computeIfAbsent(dep.getTaskId(), k -> new HashSet<>()).add(dep.getPrerequisiteId());
        }

        return tasks.stream().map(task -> {
            boolean blocked = task.getStatus() != TaskStatus.DONE && engine.isBlocked(task.getId(), edges, tasksById);
            String reason = blocked ? engine.blockedReason(task.getId(), edges, tasksById) : null;
            List<UUID> prereqIds = new ArrayList<>(edges.getOrDefault(task.getId(), Set.of()));
            return TaskResponse.from(task, blocked, reason, prereqIds);
        }).toList();
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(@Valid @RequestBody CreateTaskRequest request) {
        Task task = new Task(request.title(), request.description(), request.durationDays(), request.earliestStart());
        taskRepository.save(task);
        return ResponseEntity.ok(TaskResponse.from(task, false, null, List.of()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TaskResponse> updateTask(@PathVariable UUID id, @RequestBody Map<String, Object> updates) {
        Task task = taskRepository.findById(id).orElseThrow();
        if (updates.containsKey("status")) {
            task.setStatus(TaskStatus.valueOf((String) updates.get("status")));
        }
        if (updates.containsKey("boardPosition")) {
            task.setBoardPosition((Integer) updates.get("boardPosition"));
        }
        taskRepository.save(task);
        engine.recomputeSchedule();
        return ResponseEntity.ok(TaskResponse.from(task, false, null, List.of()));
    }
}