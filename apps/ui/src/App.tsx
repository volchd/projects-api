import { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

type Project = {
  id: string;
  name: string;
  description: string | null;
  statuses: string[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const apiUrl = (path: string) => {
  if (!API_BASE) {
    return path;
  }
  return `${API_BASE.replace(/\/$/, '')}${path}`;
};

const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch(apiUrl('/projects'));
  if (!response.ok) {
    throw new Error(`Failed to load projects (${response.status})`);
  }

  const data = (await response.json()) as { items?: Project[] };
  return data.items ?? [];
};

const createProject = async (payload: { name: string; description: string | null }) => {
  const response = await fetch(apiUrl('/projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    const message =
      (Array.isArray(data?.errors) && data.errors.join(', ')) ||
      (typeof data?.message === 'string' ? data.message : 'Failed to create project');
    throw new Error(message);
  }
};

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const items = await fetchProjects();
        if (!cancelled) {
          setProjects(items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setSaveError('Project name is required');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      await createProject({
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
      });
      setName('');
      setDescription('');
      const items = await fetchProjects();
      setProjects(items);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Projects</h1>
        <p>Interact with the Serverless API through a minimal UI.</p>
      </header>

      <section className="panel">
        <h2>Create project</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              disabled={saving}
              required
            />
          </label>

          <label>
            <span>Description (optional)</span>
            <textarea
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description"
              disabled={saving}
              rows={3}
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Create project'}
          </button>
          {saveError ? <p className="form__error">{saveError}</p> : null}
        </form>
      </section>

      <section className="panel">
        <h2>Projects list</h2>
        {loading ? <p>Loading…</p> : null}
        {error ? <p className="panel__error">{error}</p> : null}

        {!loading && !error && sortedProjects.length === 0 ? <p>No projects yet.</p> : null}

        <ul className="projects">
          {sortedProjects.map((project) => (
            <li key={project.id} className="projects__item">
              <header>
                <strong>{project.name}</strong>
                {project.description ? <p>{project.description}</p> : null}
              </header>
              <footer>
                <small>ID: {project.id}</small>
                {project.statuses?.length ? (
                  <small>Statuses: {project.statuses.join(', ')}</small>
                ) : null}
              </footer>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default App;
