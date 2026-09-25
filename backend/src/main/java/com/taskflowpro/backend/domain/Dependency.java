package com.taskflowpro.backend.domain;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "dependencies",
        uniqueConstraints = @UniqueConstraint(columnNames = {"task_id", "prerequisite_id"}))
public class Dependency {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "prerequisite_id", nullable = false)
    private UUID prerequisiteId;

    protected Dependency() {}

    public Dependency(UUID taskId, UUID prerequisiteId) {
        if (taskId.equals(prerequisiteId)) {
            throw new IllegalArgumentException("A task cannot depend on itself");
        }
        this.taskId = taskId;
        this.prerequisiteId = prerequisiteId;
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getPrerequisiteId() { return prerequisiteId; }
}