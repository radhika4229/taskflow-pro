package com.taskflowpro.backend.api;

import com.taskflowpro.backend.engine.DependencyEngine;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
public class CriticalPathController {

    private final DependencyEngine engine;

    public CriticalPathController(DependencyEngine engine) {
        this.engine = engine;
    }

    @GetMapping("/api/critical-path")
    public List<UUID> criticalPath() {
        return engine.getCriticalPath();
    }
}