package com.taskflowpro.backend.engine;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class RollbackTest {

    private final CycleChecker cycleChecker = new CycleChecker();

    private boolean isBlocked(UUID taskId, Map<UUID, Set<UUID>> edges, Map<UUID, String> statusById) {
        return edges.getOrDefault(taskId, Set.of()).stream()
                .anyMatch(prereqId -> !"DONE".equals(statusById.get(prereqId)));
    }

    @Test
    void movingDoneTaskBackToInProgressReblocksDependents() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();

        Map<UUID, Set<UUID>> edges = Map.of(
                b, Set.of(a),
                c, Set.of(a)
        );
        Map<UUID, String> status = new HashMap<>();
        status.put(a, "DONE");
        status.put(b, "BACKLOG");
        status.put(c, "BACKLOG");


        assertFalse(isBlocked(b, edges, status));
        assertFalse(isBlocked(c, edges, status));


        status.put(a, "IN_PROGRESS");

         assertTrue(isBlocked(b, edges, status));
        assertTrue(isBlocked(c, edges, status));
    }

    @Test
    void cycleCheckerStillRejectsAfterRollback() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        Map<UUID, Set<UUID>> edges = new HashMap<>();
        edges.put(b, Set.of(a));

        assertTrue(cycleChecker.wouldCreateCycle(edges, a, b),
                "Rollback state shouldn't change the graph's cycle rules");
    }
}