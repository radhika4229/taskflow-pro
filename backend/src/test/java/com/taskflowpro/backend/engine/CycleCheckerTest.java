package com.taskflowpro.backend.engine;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class CycleCheckerTest {

    private final CycleChecker checker = new CycleChecker();

    @Test
    void simpleChainHasNoCycle() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();

        Map<UUID, Set<UUID>> edges = new HashMap<>();
        edges.put(b, Set.of(a));
        edges.put(c, Set.of(b));


        UUID d = UUID.randomUUID();
        assertFalse(checker.wouldCreateCycle(edges, d, c));
    }

    @Test
    void directCycleIsDetected() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        Map<UUID, Set<UUID>> edges = new HashMap<>();
        edges.put(b, Set.of(a)); // b depends on a

          assertTrue(checker.wouldCreateCycle(edges, a, b));
    }

    @Test
    void longCycleIsDetected() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();

        Map<UUID, Set<UUID>> edges = new HashMap<>();
        edges.put(b, Set.of(a));
        edges.put(c, Set.of(b));


        assertTrue(checker.wouldCreateCycle(edges, a, c));
    }

    @Test
    void taskCannotDependOnItself() {
        UUID a = UUID.randomUUID();
        Map<UUID, Set<UUID>> edges = new HashMap<>();
        assertTrue(checker.wouldCreateCycle(edges, a, a));
    }

    @Test
    void diamondConvergenceHasNoCycle() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        UUID d = UUID.randomUUID();

        Map<UUID, Set<UUID>> edges = new HashMap<>();
        edges.put(b, Set.of(a));
        edges.put(c, Set.of(a));
        edges.put(d, Set.of(b, c));
        assertFalse(checker.wouldCreateCycle(edges, d, b));
        assertFalse(checker.wouldCreateCycle(edges, d, c));
    }
}