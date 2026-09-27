package com.taskflowpro.backend.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.util.List;
import java.util.Map;

@Component
public class LlmClient {

    private final RestClient restClient;
    private final String apiKey;
    private final String model;

    public LlmClient(
            @Value("${llm.api-key:}") String apiKey,
            @Value("${llm.model:gemini-2.0-flash}") String model) {
        this.apiKey = apiKey;
        this.model = model;
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .build();
    }

    /** Sends a prompt, returns the raw text response. Throws on failure, caller must handle. */
    @SuppressWarnings("unchecked")
    public String complete(String systemPrompt, String userPrompt) {
        if (apiKey.isBlank()) {
            throw new IllegalStateException("LLM API key not configured");
        }

        Map<String, Object> body = Map.of(
                "system_instruction", Map.of(
                        "parts", List.of(Map.of("text", systemPrompt))
                ),
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", userPrompt)))
                )
        );

        Map<String, Object> response = restClient.post()
                .uri("/models/{model}:generateContent?key={key}", model, apiKey)
                .header("content-type", "application/json")
                .body(body)
                .retrieve()
                .body(Map.class);

        var candidates = (List<Map<String, Object>>) response.get("candidates");
        var content = (Map<String, Object>) candidates.get(0).get("content");
        var parts = (List<Map<String, Object>>) content.get("parts");
        String text = (String) parts.get(0).get("text");

         return text.replaceAll("```json", "").replaceAll("```", "").trim();
    }
}