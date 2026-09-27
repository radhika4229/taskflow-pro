package com.taskflowpro.backend.api.dto;

import java.time.LocalDate;

public record CreateTaskRequest(
        String title,
        String description,
        String status,
        Integer durationDays,
        LocalDate earliestStart,
        LocalDate startDate,
        LocalDate endDate
) {}