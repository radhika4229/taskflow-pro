package com.taskflowpro.backend.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String title;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.BACKLOG;

    @Column(name = "board_position")
    private int boardPosition;

    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    @Column(name = "earliest_start", nullable = false)
    private LocalDate earliestStart;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    protected Task() {}

    public Task(String title, String description, int durationDays, LocalDate earliestStart) {
        this.title = title;
        this.description = description;
        this.durationDays = durationDays;
        this.earliestStart = earliestStart;
        this.startDate = earliestStart;
        this.endDate = earliestStart.plusDays(durationDays);
    }

    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; this.updatedAt = Instant.now(); }
    public int getBoardPosition() { return boardPosition; }
    public void setBoardPosition(int p) { this.boardPosition = p; }
    public int getDurationDays() { return durationDays; }
    public LocalDate getEarliestStart() { return earliestStart; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate d) {
        this.startDate = d;
        this.endDate = d.plusDays(durationDays);
        this.updatedAt = Instant.now();
    }
    public LocalDate getEndDate() { return endDate; }
}