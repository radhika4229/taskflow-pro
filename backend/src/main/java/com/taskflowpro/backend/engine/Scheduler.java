package com.taskflowpro.backend.engine;
import java.util.Comparator;
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
    public List<UUID> findCriticalPath(Map<UUID, TaskNode> tasks, Map<UUID, Set<UUID>> dependencies) {
        List<UUID> order = topologicalOrder(tasks.keySet(), dependencies);
        Map<UUID, Integer> longestPathEndingHere = new HashMap<>();
        Map<UUID, UUID> predecessor = new HashMap<>();

        for (UUID id : order) {
            int duration = tasks.get(id).durationDays();
            int best = duration;
            UUID bestPred = null;
            for (UUID prereqId : dependencies.getOrDefault(id, Set.of())) {
                int candidate = longestPathEndingHere.get(prereqId) + duration;
                if (candidate > best) {
                    best = candidate;
                    bestPred = prereqId;
                }
            }
            longestPathEndingHere.put(id, best);
            predecessor.put(id, bestPred);
        }

        UUID endOfCriticalPath = order.stream()
                .max(Comparator.comparingInt(longestPathEndingHere::get))
                .orElse(null);

        List<UUID> path = new ArrayList<>();
        UUID current = endOfCriticalPath;
        while (current != null) {
            path.add(current);
            current = predecessor.get(current);
        }
        Collections.reverse(path);
        return path;
    }
}
