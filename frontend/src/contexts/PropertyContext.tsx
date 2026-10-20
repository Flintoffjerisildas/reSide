import { createContext, useContext, type ReactNode } from 'react';
import { useGetAllProperties } from '../hooks/useQueries';
import type { Property } from '../types';

interface PropertyContextType {
  properties: Property[];
  isLoading: boolean;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: ReactNode }) {
  const { data: properties = [], isLoading } = useGetAllProperties();

  return (
    <PropertyContext.Provider value={{ properties, isLoading }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperties must be used within PropertyProvider');
  }
  return context;
}
