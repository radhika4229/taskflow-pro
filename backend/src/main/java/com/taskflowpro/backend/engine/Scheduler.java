package com.taskflowpro.backend.engine;

import java.time.LocalDate;
import java.util.*;

public class Scheduler {
    public record TaskNode(UUID id, LocalDate earliestStart, int durationDays) {}

     public record ScheduleResult(UUID taskId, LocalDate startDate, LocalDate endDate) {}
    public Map<UUID, ScheduleResult> recompute(
            Map<UUID, TaskNode> tasks,
            Map<UUID, Set<UUID>> dependencies
    ) {
        List<UUID> order = topologicalOrder(tasks.keySet(), dependencies);
        Map<UUID, ScheduleResult> results = new HashMap<>();

        for (UUID taskId : order) {
            TaskNode node = tasks.get(taskId);
            Set<UUID> prereqs = dependencies.getOrDefault(taskId, Set.of());

            LocalDate start = node.earliestStart();
            for (UUID prereqId : prereqs) {
                ScheduleResult prereqResult = results.get(prereqId);
                LocalDate earliestPossible = prereqResult.endDate().plusDays(1);
                if (earliestPossible.isAfter(start)) {
                    start = earliestPossible;
                }
            }
            LocalDate end = start.plusDays(node.durationDays());
            results.put(taskId, new ScheduleResult(taskId, start, end));
        }
        return results;
    }

     private List<UUID> topologicalOrder(Set<UUID> allTasks, Map<UUID, Set<UUID>> dependencies) {
        Map<UUID, Integer> inDegree = new HashMap<>();
        Map<UUID, List<UUID>> dependents = new HashMap<>();

        for (UUID id : allTasks) {
            inDegree.put(id, 0);
            dependents.put(id, new ArrayList<>());
        }
        for (UUID taskId : allTasks) {
            for (UUID prereqId : dependencies.getOrDefault(taskId, Set.of())) {
                inDegree.merge(taskId, 1, Integer::sum);
                dependents.get(prereqId).add(taskId);
            }
        }

        Deque<UUID> queue = new ArrayDeque<>();
        for (UUID id : allTasks) {
            if (inDegree.get(id) == 0) queue.add(id);
        }

        List<UUID> order = new ArrayList<>();
        while (!queue.isEmpty()) {
            UUID current = queue.poll();
            order.add(current);
            for (UUID dependent : dependents.get(current)) {
                int remaining = inDegree.merge(dependent, -1, Integer::sum);
                if (remaining == 0) queue.add(dependent);
            }
        }

        if (order.size() != allTasks.size()) {
            throw new IllegalStateException("Cycle detected, cannot compute topological order");
        }
        return order;
    }
}
