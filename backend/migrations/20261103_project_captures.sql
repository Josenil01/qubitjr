BEGIN;

CREATE TABLE IF NOT EXISTS project_captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,
    project_version TEXT NOT NULL,
    hints_version TEXT NOT NULL,
    project_snapshot JSONB NOT NULL,
    hints_snapshot JSONB NOT NULL,
    expected JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE (id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_project_captures_project ON project_captures(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_captures_assignment ON project_captures(assignment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_capture_images (
    capture_id UUID NOT NULL,
    image_key TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    scene_id TEXT NOT NULL,
    scene_index INTEGER NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('scene', 'actor', 'scripts')),
    storage_path TEXT NOT NULL UNIQUE,
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    bytes INTEGER NOT NULL CHECK (bytes > 0),
    PRIMARY KEY (capture_id, image_key),
    FOREIGN KEY (capture_id, project_id) REFERENCES project_captures(id, project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_capture_images_actor ON project_capture_images(project_id, scene_id, actor_id);
ALTER TABLE project_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_capture_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON project_captures, project_capture_images FROM anon, authenticated;
GRANT ALL ON project_captures, project_capture_images TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-captures', 'project-captures', false, 3145728, ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
