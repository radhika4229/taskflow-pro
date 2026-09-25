package com.taskflowpro.backend.api.dto;

import com.taskflowpro.backend.domain.Task;
import com.taskflowpro.backend.domain.TaskStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record TaskResponse(
        UUID id,
        String title,
        String description,
        TaskStatus status,
        boolean blocked,
        String blockedReason,
        int boardPosition,
        LocalDate startDate,
        LocalDate endDate,
        List<UUID> prerequisiteIds
) {
    public static TaskResponse from(Task task, boolean blocked, String blockedReason, List<UUID> prereqIds) {
        return new TaskResponse(
                task.getId(), task.getTitle(), task.getDescription(), task.getStatus(),
                blocked, blockedReason, task.getBoardPosition(),
                task.getStartDate(), task.getEndDate(), prereqIds
        );
    }
}