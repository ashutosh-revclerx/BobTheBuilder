import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface QueryState {
  data: any;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  lastUpdated: number | null;
}

interface StateContextType {
  queryResults: Record<string, QueryState>;
  componentState: Record<string, Record<string, any>>;
  setQueryState: (queryName: string, state: Partial<QueryState>) => void;
  setComponentState: (componentId: string, key: string, value: any) => void;
  getGlobalState: () => any;
}

const StateContext = createContext<StateContextType | undefined>(undefined);

export const StateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queryResults, setQueryResults] = useState<Record<string, QueryState>>({});
  const [componentState, setComponentStateInternal] = useState<Record<string, Record<string, any>>>({});

  const setQueryState = useCallback((queryName: string, stateUpdates: Partial<QueryState>) => {
    setQueryResults(prev => ({
      ...prev,
      [queryName]: {
        ...(prev[queryName] || { data: null, status: 'idle', error: null, lastUpdated: null }),
        ...stateUpdates,
      },
    }));
  }, []);

  const setComponentState = useCallback((componentId: string, key: string, value: any) => {
    setComponentStateInternal(prev => ({
      ...prev,
      [componentId]: {
        ...(prev[componentId] || {}),
        [key]: value,
      },
    }));
  }, []);

  const getGlobalState = useCallback(() => {
    return {
      queries: queryResults,
      components: componentState,
    };
  }, [queryResults, componentState]);

  return (
    <StateContext.Provider value={{ queryResults, componentState, setQueryState, setComponentState, getGlobalState }}>
      {children}
    </StateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within a StateProvider');
  }
  return context;
};
