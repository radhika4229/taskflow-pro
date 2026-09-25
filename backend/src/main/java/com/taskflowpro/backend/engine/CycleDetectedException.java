package com.taskflowpro.backend.engine;

import java.util.UUID;

public class CycleDetectedException extends RuntimeException {
    public CycleDetectedException(UUID taskId, UUID prerequisiteId) {
        super("Adding this dependency would create a cycle involving tasks " + taskId + " and " + prerequisiteId);
    }
}