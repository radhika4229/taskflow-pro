package com.taskflowpro.backend.repository;

import com.taskflowpro.backend.domain.AiSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AiSuggestionRepository extends JpaRepository<AiSuggestion, UUID> {
    List<AiSuggestion> findByStatus(String status);
    List<AiSuggestion> findByTaskId(UUID taskId);
}