package com.taskflowpro.backend.api.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record CreateTaskRequest(
        @NotBlank String title,
        String description,
        @Min(1) int durationDays,
        @NotNull LocalDate earliestStart
) {}