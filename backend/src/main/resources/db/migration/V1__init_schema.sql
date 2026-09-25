CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE tasks (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       title VARCHAR(255) NOT NULL,
                       description TEXT,
                       status VARCHAR(20) NOT NULL DEFAULT 'BACKLOG',
                       board_position INT NOT NULL DEFAULT 0,
                       duration_days INT NOT NULL,
                       earliest_start DATE NOT NULL,
                       start_date DATE,
                       end_date DATE,
                       created_at TIMESTAMP NOT NULL DEFAULT now(),
                       updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE dependencies (
                              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                              prerequisite_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                              UNIQUE (task_id, prerequisite_id),
                              CHECK (task_id != prerequisite_id)
    );

CREATE TABLE ai_suggestions (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                                suggested_prerequisite_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                                reason TEXT,
                                confidence VARCHAR(10) NOT NULL,
                                status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
                                model_name VARCHAR(100),
                                created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_dep_task ON dependencies(task_id);
CREATE INDEX idx_dep_prereq ON dependencies(prerequisite_id);