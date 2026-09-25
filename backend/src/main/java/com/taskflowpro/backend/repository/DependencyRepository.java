package com.taskflowpro.backend.repository;
import com.taskflowpro.backend.domain.Dependency;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface DependencyRepository extends JpaRepository<Dependency, UUID> {
    List<Dependency> findByTaskId(UUID taskId);
}