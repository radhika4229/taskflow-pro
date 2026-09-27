package com.taskflowpro.backend.ai;

import tools.jackson.databind.json.JsonMapper;
import com.taskflowpro.backend.domain.*;
import com.taskflowpro.backend.engine.CycleChecker;
import com.taskflowpro.backend.engine.DependencyEngine;
import com.taskflowpro.backend.repository.*;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class AiSuggestionService {

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;
    private final AiSuggestionRepository suggestionRepository;
    private final DependencyEngine dependencyEngine;
    private final LlmClient llmClient;
    private final CycleChecker cycleChecker = new CycleChecker();
    private final JsonMapper mapper = JsonMapper.builder().build();

    private static final String MODEL_NAME = "gemini-2.0-flash";
    private static final int MAX_SUGGESTIONS = 5;



    public AiSuggestionService(TaskRepository taskRepository, DependencyRepository dependencyRepository,
                               AiSuggestionRepository suggestionRepository, DependencyEngine dependencyEngine,
                               LlmClient llmClient) {
        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;
        this.suggestionRepository = suggestionRepository;
        this.dependencyEngine = dependencyEngine;
        this.llmClient = llmClient;
    }

      public List<AiSuggestion> generateSuggestions(UUID taskId) {
        Task target = taskRepository.findById(taskId).orElseThrow();
        List<Task> others = taskRepository.findAll().stream()
                .filter(t -> !t.getId().equals(taskId))
                .toList();

        String systemPrompt = """
            You suggest task prerequisites for a project management tool.
            Rules you must follow exactly:
            - Only use task ids from the list given to you. Never invent an id.
            - Suggest at most 5 prerequisites.
            - Respond with ONLY a JSON array, no other text, no markdown fences.
            - Each item: {"prerequisiteId": "<id>", "confidence": "LOW"|"MEDIUM"|"HIGH", "reason": "<short reason>"}
            """;

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("Target task: ").append(target.getId()).append(" - ")
                .append(target.getTitle()).append(": ").append(target.getDescription()).append("\n\n");
        userPrompt.append("Candidate tasks (id - title: description):\n");
        for (Task t : others) {
            userPrompt.append(t.getId()).append(" - ").append(t.getTitle())
                    .append(": ").append(t.getDescription()).append("\n");
        }

        String raw;
        try {
            raw = llmClient.complete(systemPrompt, userPrompt.toString());
        } catch (Exception e) {
              return List.of();
        }

        return validateAndSave(taskId, raw, others);
    }

    private List<AiSuggestion> validateAndSave(UUID taskId, String rawJson, List<Task> validCandidates) {
        Set<UUID> validIds = new HashSet<>();
        for (Task t : validCandidates) validIds.add(t.getId());

        Map<UUID, Set<UUID>> existingEdges = new HashMap<>();
        for (Dependency dep : dependencyRepository.findAll()) {
            existingEdges.computeIfAbsent(dep.getTaskId(), k -> new HashSet<>()).add(dep.getPrerequisiteId());
        }
        Set<UUID> existingPrereqs = existingEdges.getOrDefault(taskId, Set.of());

        List<AiSuggestion> saved = new ArrayList<>();
        try {
            var parsed = mapper.readTree(rawJson);
            int count = 0;
            for (var item : parsed) {
                if (count >= MAX_SUGGESTIONS) break;
                String idStr = item.path("prerequisiteId").asString(null);
                if (idStr == null) continue;

                UUID prereqId;
                try {
                    prereqId = UUID.fromString(idStr);
                } catch (IllegalArgumentException e) {
                    continue;     }

                  if (!validIds.contains(prereqId)) continue;
                if (existingPrereqs.contains(prereqId)) continue;
                if (cycleChecker.wouldCreateCycle(existingEdges, taskId, prereqId)) continue;

                String confidence = item.path("confidence").asString("LOW");
                String reason = item.path("reason").asString("");

                AiSuggestion suggestion = new AiSuggestion(taskId, prereqId, reason, confidence, MODEL_NAME);
                suggestionRepository.save(suggestion);
                saved.add(suggestion);
                count++;
            }
        } catch (Exception e) {
            return List.of();   }
        return saved;
    }

    public void accept(UUID suggestionId) {
        AiSuggestion suggestion = suggestionRepository.findById(suggestionId).orElseThrow();
        dependencyEngine.addDependency(suggestion.getTaskId(), suggestion.getSuggestedPrerequisiteId());
        suggestion.setStatus("ACCEPTED");
        suggestionRepository.save(suggestion);
    }

    public void reject(UUID suggestionId) {
        AiSuggestion suggestion = suggestionRepository.findById(suggestionId).orElseThrow();
        suggestion.setStatus("REJECTED");
        suggestionRepository.save(suggestion);
    }
}