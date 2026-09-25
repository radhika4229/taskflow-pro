package com.taskflowpro.backend.api.dto;

import java.util.UUID;

public record AddDependencyRequest(UUID taskId, UUID prerequisiteId) {}