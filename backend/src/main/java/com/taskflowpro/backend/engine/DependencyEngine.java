package com.taskflowpro.backend.engine;

import com.taskflowpro.backend.domain.Task;
import com.taskflowpro.backend.domain.Dependency;
import com.taskflowpro.backend.repository.TaskRepository;
import com.taskflowpro.backend.repository.DependencyRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class DependencyEngine {

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;
    private final CycleChecker cycleChecker = new CycleChecker();
    private final Scheduler scheduler = new Scheduler();

    public DependencyEngine(TaskRepository taskRepository, DependencyRepository dependencyRepository) {
        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;
    }

    /** Builds taskId -> set of prerequisite ids from all stored dependencies. */
    private Map<UUID, Set<UUID>> loadEdgeMap() {
        Map<UUID, Set<UUID>> edges = new HashMap<>();
        for (Dependency dep : dependencyRepository.findAll()) {
            edges.computeIfAbsent(dep.getTaskId(), k -> new HashSet<>()).add(dep.getPrerequisiteId());
        }
        return edges;
    }

    public boolean isBlocked(UUID taskId, Map<UUID, Set<UUID>> edges, Map<UUID, Task> tasksById) {
        Set<UUID> prereqs = edges.getOrDefault(taskId, Set.of());
        return prereqs.stream()
                .map(tasksById::get)
                .anyMatch(t -> t != null && t.getStatus() != com.taskflowpro.backend.domain.TaskStatus.DONE);
    }

    public String blockedReason(UUID taskId, Map<UUID, Set<UUID>> edges, Map<UUID, Task> tasksById) {
        return edges.getOrDefault(taskId, Set.of()).stream()
                .map(tasksById::get)
                .filter(t -> t != null && t.getStatus() != com.taskflowpro.backend.domain.TaskStatus.DONE)
                .map(Task::getTitle)
                .collect(Collectors.joining(", "));
    }

    @Transactional
    public Dependency addDependency(UUID taskId, UUID prerequisiteId) {
        Map<UUID, Set<UUID>> edges = loadEdgeMap();
        if (cycleChecker.wouldCreateCycle(edges, taskId, prerequisiteId)) {
            throw new CycleDetectedException(taskId, prerequisiteId);
        }
        Dependency dependency = new Dependency(taskId, prerequisiteId);
        dependencyRepository.save(dependency);
        recomputeSchedule();
        return dependency;
    }

    @Transactional
    public void recomputeSchedule() {
        List<Task> allTasks = taskRepository.findAll();
        Map<UUID, Scheduler.TaskNode> nodes = allTasks.stream()
                .collect(Collectors.toMap(Task::getId,
                        t -> new Scheduler.TaskNode(t.getId(), t.getEarliestStart(), t.getDurationDays())));
        Map<UUID, Set<UUID>> edges = loadEdgeMap();

        Map<UUID, Scheduler.ScheduleResult> results = scheduler.recompute(nodes, edges);

        for (Task task : allTasks) {
            Scheduler.ScheduleResult result = results.get(task.getId());
            if (result != null && !result.startDate().equals(task.getStartDate())) {
                task.setStartDate(result.startDate());
                taskRepository.save(task);
            }
        }
    }
}