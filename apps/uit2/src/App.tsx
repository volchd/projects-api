import { useState } from 'react';
import './index.css';
import { Header } from './components/Header';
import { ProjectList } from './components/ProjectList';
import { TaskBoard } from './components/TaskBoard';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      <div className="w-64 flex-shrink-0 overflow-y-auto bg-white shadow-md">
        <ProjectList
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 p-4">
          {selectedProjectId ? (
            <TaskBoard key={selectedProjectId} projectId={selectedProjectId} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg bg-white text-stone-500">
              Select a project to see its tasks
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
