import { useState } from 'react';
import './index.css';
import { Header } from './components/Header';
import { ProjectList } from './components/ProjectList';
import { TaskBoard } from './components/TaskBoard';

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-md">
        <ProjectList
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
        />
      </div>
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4">
          {selectedProjectId ? (
            <TaskBoard key={selectedProjectId} projectId={selectedProjectId} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-md bg-white text-gray-500">
              Select a project to see its tasks
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
