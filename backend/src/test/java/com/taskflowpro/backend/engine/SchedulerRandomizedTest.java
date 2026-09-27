package com.taskflowpro.backend.engine;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.taskflowpro.backend.engine.Scheduler.*;

class SchedulerRandomizedTest {

    private final Scheduler scheduler = new Scheduler();
    private final Random random = new Random(42);
    @Test
    void randomizedGraphsAlwaysGiveConsistentResults() {
        for (int trial = 0; trial < 50; trial++) {
            int taskCount = 4 + random.nextInt(8);      List<UUID> ids = new ArrayList<>();
            for (int i = 0; i < taskCount; i++) ids.add(UUID.randomUUID());

            Map<UUID, TaskNode> tasks = new HashMap<>();
            Map<UUID, Set<UUID>> deps = new HashMap<>();
            LocalDate start = LocalDate.of(2026, 1, 1);

            for (int i = 0; i < taskCount; i++) {
                UUID id = ids.get(i);
                int duration = 1 + random.nextInt(5);
                tasks.put(id, new TaskNode(id, start, duration));

                    if (i > 0) {
                    Set<UUID> prereqs = new HashSet<>();
                    int possiblePrereqs = random.nextInt(Math.min(i, 3) + 1);
                    for (int p = 0; p < possiblePrereqs; p++) {
                        prereqs.add(ids.get(random.nextInt(i)));
                    }
                    if (!prereqs.isEmpty()) deps.put(id, prereqs);
                }
            }

                Map<UUID, ScheduleResult> fast = scheduler.recompute(tasks, deps);

                  Map<UUID, LocalDate> naive = new HashMap<>();
            for (UUID id : ids) computeNaively(id, tasks, deps, naive);

            for (UUID id : ids) {
                assertEquals(naive.get(id), fast.get(id).startDate(),
                        "Mismatch for task " + id + " on trial " + trial);
            }
        }
    }

     private LocalDate computeNaively(UUID id, Map<UUID, TaskNode> tasks, Map<UUID, Set<UUID>> deps, Map<UUID, LocalDate> memo) {
        if (memo.containsKey(id)) return memo.get(id);
        TaskNode node = tasks.get(id);
        LocalDate start = node.earliestStart();
        for (UUID prereqId : deps.getOrDefault(id, Set.of())) {
            LocalDate prereqStart = computeNaively(prereqId, tasks, deps, memo);
            LocalDate prereqEnd = prereqStart.plusDays(tasks.get(prereqId).durationDays());
            LocalDate earliestPossible = prereqEnd.plusDays(1);
            if (earliestPossible.isAfter(start)) start = earliestPossible;
        }
        memo.put(id, start);
        return start;
    }
}