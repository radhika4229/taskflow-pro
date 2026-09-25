package com.taskflowpro.backend.engine;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.taskflowpro.backend.engine.Scheduler.*;

class SchedulerTest {

    private final Scheduler scheduler = new Scheduler();

    @Test
    void simpleChainPropagatesDelay() {
        LocalDate start = LocalDate.of(2026, 9, 25);
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();

        Map<UUID, TaskNode> tasks = Map.of(
                a, new TaskNode(a, start, 5),
                b, new TaskNode(b, start, 2),
                c, new TaskNode(c, start, 2)
        );
        Map<UUID, Set<UUID>> deps = Map.of(
                b, Set.of(a),
                c, Set.of(b)
        );

        Map<UUID, ScheduleResult> result = scheduler.recompute(tasks, deps);

        assertEquals(start, result.get(a).startDate());
        assertEquals(start.plusDays(6), result.get(b).startDate()); // day after A ends
        assertEquals(result.get(b).endDate().plusDays(1), result.get(c).startDate());
    }

    @Test
    void diamondDoesNotCompoundDelay() {
        LocalDate start = LocalDate.of(2026, 9, 25);
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        UUID d = UUID.randomUUID();

         Map<UUID, TaskNode> tasks = Map.of(
                a, new TaskNode(a, start, 5),
                b, new TaskNode(b, start, 2),
                c, new TaskNode(c, start, 2),
                d, new TaskNode(d, start, 2)
        );
        Map<UUID, Set<UUID>> deps = Map.of(
                b, Set.of(a),
                c, Set.of(a),
                d, Set.of(b, c)
        );

        Map<UUID, ScheduleResult> result = scheduler.recompute(tasks, deps);

        LocalDate aEnd = result.get(a).endDate();
         assertEquals(aEnd.plusDays(1), result.get(b).startDate());
        assertEquals(aEnd.plusDays(1), result.get(c).startDate());

         LocalDate expectedDStart = result.get(b).endDate().isAfter(result.get(c).endDate())
                ? result.get(b).endDate().plusDays(1)
                : result.get(c).endDate().plusDays(1);
        assertEquals(expectedDStart, result.get(d).startDate());

          LocalDate originalAEnd = start.plusDays(2);
        LocalDate originalBCStart = originalAEnd.plusDays(1);
        LocalDate originalBCEnd = originalBCStart.plusDays(2);
        LocalDate originalDStart = originalBCEnd.plusDays(1);

        long actualDelay = java.time.temporal.ChronoUnit.DAYS.between(originalDStart, result.get(d).startDate());
        assertEquals(3, actualDelay, "D should move by exactly A's 3 day delay, not compound through both paths");
    }

    @Test
    void cyclePreventsScheduling() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        Map<UUID, TaskNode> tasks = Map.of(
                a, new TaskNode(a, LocalDate.now(), 1),
                b, new TaskNode(b, LocalDate.now(), 1)
        );
        Map<UUID, Set<UUID>> deps = Map.of(
                a, Set.of(b),
                b, Set.of(a)
        );
        assertThrows(IllegalStateException.class, () -> scheduler.recompute(tasks, deps));
    }
}