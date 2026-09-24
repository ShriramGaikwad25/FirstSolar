'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  department: string;
  jobTitle: string;
  employeeId?: string;
}

interface SelectedUsersContextType {
  selectedUsers: User[];
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  clearUsers: () => void;
  setSelectedUsers: (users: User[]) => void;
  // Persisted so the User Search tab in access-request/jit-access keeps its results
  // when the wizard step changes and UserSearchTab unmounts/remounts.
  searchCriteria: string;
  setSearchCriteria: (criteria: string) => void;
  searchValue: string;
  setSearchValue: (value: string) => void;
  searchResults: User[];
  setSearchResults: (users: User[]) => void;
  hasSearched: boolean;
  setHasSearched: (hasSearched: boolean) => void;
}

const SelectedUsersContext = createContext<SelectedUsersContextType | undefined>(undefined);

export function SelectedUsersProvider({ children }: { children: ReactNode }) {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchCriteria, setSearchCriteria] = useState("name");
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const addUser = useCallback((user: User) => {
    setSelectedUsers((prev) => {
      if (prev.some((u) => u.id === user.id)) {
        return prev;
      }
      return [...prev, user];
    });
  }, []);

  const removeUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => prev.filter((user) => user.id !== userId));
  }, []);

  const clearUsers = useCallback(() => {
    setSelectedUsers([]);
    setSearchCriteria("name");
    setSearchValue("");
    setSearchResults([]);
    setHasSearched(false);
  }, []);

  const value = {
    selectedUsers,
    addUser,
    removeUser,
    clearUsers,
    setSelectedUsers,
    searchCriteria,
    setSearchCriteria,
    searchValue,
    setSearchValue,
    searchResults,
    setSearchResults,
    hasSearched,
    setHasSearched,
  };

  return <SelectedUsersContext.Provider value={value}>{children}</SelectedUsersContext.Provider>;
}

export function useSelectedUsers(): SelectedUsersContextType {
  const context = useContext(SelectedUsersContext);
  if (context === undefined) {
    throw new Error('useSelectedUsers must be used within a SelectedUsersProvider');
  }
  return context;
}



