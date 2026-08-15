'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Completely isolate ag-grid from SSR with more aggressive loading
const AgGridReact = dynamic(
  () => {
    // Ensure we're in browser environment
    if (typeof window === 'undefined') {
      return Promise.resolve(() => <div>Loading...</div>);
    }
    return import('ag-grid-react').then((mod) => mod.AgGridReact);
  },
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-32">Loading grid...</div>
  }
) as ComponentType<any>;

export default AgGridReact;
