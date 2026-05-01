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
    <div className="exported-dashboard-app">
      <header className="exported-dashboard-header">
        <div className="exported-dashboard-brand">
          <span className="exported-dashboard-logo">B</span>
          <h1 className="exported-dashboard-title">{dashboardConfig.name}</h1>
        </div>
        <span className="exported-dashboard-meta">Exported dashboard</span>
      </header>
      <main className="exported-dashboard-main">
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
