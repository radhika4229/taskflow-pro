package com.taskflowpro.backend.api;

import com.taskflowpro.backend.api.dto.AddDependencyRequest;
import com.taskflowpro.backend.domain.Dependency;
import com.taskflowpro.backend.engine.CycleDetectedException;
import com.taskflowpro.backend.engine.DependencyEngine;
import com.taskflowpro.backend.repository.DependencyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/dependencies")
public class DependencyController {

    private final DependencyEngine engine;
    private final DependencyRepository dependencyRepository;

    public DependencyController(DependencyEngine engine, DependencyRepository dependencyRepository) {
        this.engine = engine;
        this.dependencyRepository = dependencyRepository;
    }

    @PostMapping
    public ResponseEntity<?> addDependency(@RequestBody AddDependencyRequest request) {
        try {
            Dependency dep = engine.addDependency(request.taskId(), request.prerequisiteId());
            return ResponseEntity.ok(dep);
        } catch (CycleDetectedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removeDependency(@PathVariable UUID id) {
        dependencyRepository.deleteById(id);
        engine.recomputeSchedule();
        return ResponseEntity.noContent().build();
    }


    }

