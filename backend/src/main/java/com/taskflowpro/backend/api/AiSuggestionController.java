package com.taskflowpro.backend.api;

import com.taskflowpro.backend.ai.AiSuggestionService;
import com.taskflowpro.backend.domain.AiSuggestion;
import com.taskflowpro.backend.engine.CycleDetectedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class AiSuggestionController {

    private final AiSuggestionService service;

    public AiSuggestionController(AiSuggestionService service) {
        this.service = service;
    }

    @PostMapping("/api/tasks/{id}/suggestions")
    public List<AiSuggestion> suggest(@PathVariable UUID id) {
        return service.generateSuggestions(id);
    }

    @PostMapping("/api/suggestions/{id}/accept")
    public ResponseEntity<?> accept(@PathVariable UUID id) {
        try {
            service.accept(id);
            return ResponseEntity.ok().build();
        } catch (CycleDetectedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/suggestions/{id}/reject")
    public ResponseEntity<Void> reject(@PathVariable UUID id) {
        service.reject(id);
        return ResponseEntity.noContent().build();
    }
}