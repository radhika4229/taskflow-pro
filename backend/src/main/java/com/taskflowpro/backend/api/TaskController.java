package com.taskflowpro.backend.api;

import com.taskflowpro.backend.api.dto.*;
import com.taskflowpro.backend.domain.*;
import com.taskflowpro.backend.engine.DependencyEngine;
import com.taskflowpro.backend.repository.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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
    public ResponseEntity<TaskResponse> createTask(@RequestBody CreateTaskRequest request) {
        LocalDate earliestStart = request.earliestStart() != null
                ? request.earliestStart()
                : (request.startDate() != null ? request.startDate() : LocalDate.now());

        int durationDays;
        if (request.durationDays() != null) {
            durationDays = request.durationDays();
        } else if (request.startDate() != null && request.endDate() != null) {
            durationDays = (int) java.time.temporal.ChronoUnit.DAYS.between(request.startDate(), request.endDate());
            if (durationDays < 1) durationDays = 1;
        } else {
            durationDays = 1;
        }

        Task task = new Task(request.title(), request.description(), durationDays, earliestStart);
        if (request.status() != null) {
            task.setStatus(TaskStatus.valueOf(request.status()));
        }
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
    @PostMapping("/{id}/preview")
    public ResponseEntity<?> preview(@PathVariable UUID id, @RequestBody Map<String, Object> changes) {
        java.time.LocalDate newStart = changes.containsKey("earliestStart")
                ? java.time.LocalDate.parse((String) changes.get("earliestStart")) : null;
        Integer newDuration = changes.containsKey("durationDays")
                ? (Integer) changes.get("durationDays") : null;

        var result = engine.previewChange(id, newStart, newDuration);
        var affected = result.entrySet().stream()
                .filter(e -> {
                    Task original = taskRepository.findById(e.getKey()).orElse(null);
                    return original != null && !e.getValue().startDate().equals(original.getStartDate());
                })
                .map(e -> Map.of(
                        "taskId", e.getKey(),
                        "newStartDate", e.getValue().startDate(),
                        "newEndDate", e.getValue().endDate()
                ))
                .toList();
        return ResponseEntity.ok(Map.of("affectedTasks", affected));
    }
}