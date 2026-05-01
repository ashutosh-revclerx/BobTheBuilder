import React from 'react';
import { StateProvider } from './runtime/StateManager';
import { useQueryEngine } from './runtime/QueryEngine';
import Renderer from './runtime/Renderer';

// Config files (in the exported app, these will be local JSON files)
import dashboardConfig from './config/dashboard.json';
import queriesConfig from './config/queries.json';

const DashboardApp = () => {
  // Initialize query engine with config
  useQueryEngine(queriesConfig as any);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-4 px-8">
        <h1 className="text-xl font-bold text-gray-800">{dashboardConfig.name}</h1>
      </header>
      <main>
        <Renderer config={dashboardConfig as any} />
      </main>
    </div>
  );
};

function App() {
  return (
    <StateProvider>
      <DashboardApp />
    </StateProvider>
  );
}

export default App;
