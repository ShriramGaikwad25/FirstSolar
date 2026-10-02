"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import Modal from "@/components/Modal";
import {
  User,
  UserFilter,
  buildUserSearchFilter,
  fetchUserPage,
  userSearchOptions,
} from "@/lib/userSearch";

const PAGE_SIZE = 20;

interface UserPickerModalProps {
  open: boolean;
  title?: string;
  /** userId of the currently chosen user, highlighted in the results */
  selectedUserId?: string | null;
  onSelect: (user: User) => void;
  onClose: () => void;
}

/** Search the user directory and pick a single user. */
export default function UserPickerModal({
  open,
  title = "Select User",
  selectedUserId,
  onSelect,
  onClose,
}: UserPickerModalProps) {
  const [criteria, setCriteria] = useState("name");
  const [value, setValue] = useState("");
  const [filter, setFilter] = useState<UserFilter | null>(null);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<User | null>(null);

  // Start fresh each time the modal opens
  useEffect(() => {
    if (!open) return;
    setValue("");
    setFilter(null);
    setPage(1);
    setResults([]);
    setTotal(0);
    setError(null);
    setPicked(null);
  }, [open]);

  const load = async (nextFilter: UserFilter, nextPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const { users, total } = await fetchUserPage(nextFilter, nextPage, PAGE_SIZE);
      setResults(users);
      setTotal(total);
      setFilter(nextFilter);
      setPage(nextPage);
    } catch (err) {
      console.error("Error searching users:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      setResults([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (!value.trim() || isLoading) return;
    load(buildUserSearchFilter(criteria, value), 1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const criteriaLabel = userSearchOptions.find((o) => o.value === criteria)?.label || "search value";
  const activeId = picked?.userId ?? selectedUserId;

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!picked}
            onClick={() => picked && onSelect(picked)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            Select
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-44">
            <select
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {userSearchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder={`Enter ${criteriaLabel}...`}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={!value.trim() || isLoading}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              value.trim() && !isLoading
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-300 text-gray-500"
            }`}
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 p-6 text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            Searching...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">Error: {error}</div>
        )}

        {!isLoading && !error && !filter && (
          <p className="py-6 text-center text-sm text-gray-500">Search for a user to select.</p>
        )}

        {!isLoading && !error && filter && results.length === 0 && (
          <p className="rounded-md border border-gray-200 py-6 text-center text-sm text-gray-500">
            No users found.
          </p>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div>
            <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200">
              {results.map((user) => {
                const isActive = Boolean(activeId) && user.userId === activeId;
                return (
                  <button
                    type="button"
                    key={user.userId || user.email}
                    onClick={() => setPicked(user)}
                    onDoubleClick={() => onSelect(user)}
                    className={`flex w-full items-center gap-3 border-b border-gray-200 p-3 text-left last:border-b-0 transition-colors ${
                      isActive ? "border-l-4 border-l-blue-600 bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        isActive ? "border-blue-600" : "border-gray-300"
                      }`}
                    >
                      {isActive && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-900">{user.name}</span>
                        {user.username && <span className="text-xs text-gray-500">({user.username})</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-600">{user.email}</span>
                      {(user.department || user.title) && (
                        <span className="mt-0.5 block truncate text-xs text-gray-500">
                          {[user.department, user.title].filter(Boolean).join(" • ")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
              <span>
                {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => filter && load(filter, page - 1)}
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  Prev
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => filter && load(filter, page + 1)}
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
