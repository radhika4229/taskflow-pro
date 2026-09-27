package com.taskflowpro.backend.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_suggestions")
public class AiSuggestion {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "suggested_prerequisite_id", nullable = false)
    private UUID suggestedPrerequisiteId;

    private String reason;

    @Column(nullable = false)
    private String confidence;

    @Column(nullable = false)
    private String status = "PENDING";
    @Column(name = "model_name")
    private String modelName;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    protected AiSuggestion() {}

    public AiSuggestion(UUID taskId, UUID suggestedPrerequisiteId, String reason, String confidence, String modelName) {
        this.taskId = taskId;
        this.suggestedPrerequisiteId = suggestedPrerequisiteId;
        this.reason = reason;
        this.confidence = confidence;
        this.modelName = modelName;
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getSuggestedPrerequisiteId() { return suggestedPrerequisiteId; }
    public String getReason() { return reason; }
    public String getConfidence() { return confidence; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getModelName() { return modelName; }
}
