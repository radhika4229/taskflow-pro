package com.taskflowpro.backend.engine;
import java.util.*;
public class CycleChecker {

    public boolean wouldCreateCycle(Map<UUID, Set<UUID>> existingEdges, UUID taskId, UUID prerequisiteId) {
        if (taskId.equals(prerequisiteId)) {
            return true;
        }
        Set<UUID> visited = new HashSet<>();
        Deque<UUID> stack = new ArrayDeque<>();
        stack.push(prerequisiteId);

        while (!stack.isEmpty()) {
            UUID current = stack.pop();
            if (current.equals(taskId)) {
                return true;
            }
            if (!visited.add(current)) continue;
            stack.addAll(existingEdges.getOrDefault(current, Set.of()));
        }
        return false;
    }

}
