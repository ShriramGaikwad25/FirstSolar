import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleCheck } from "lucide-react";
import { executeQuery } from "@/lib/api";

type Attribute = {
  value: string;
  label: string;
};

type User = Record<string, string>;
type Group = Record<string, string>;

// Maps a selectable "Select Attribute" value to the real usr/kf_groups column to query.
// email is stored as jsonb, so it needs a ::text cast for ILIKE. Attributes with no
// known column (e.g. the placeholder "role" option on groups) fall back to a safe default.
const USER_QUERY_COLUMNS: Record<string, string> = {
  username: "username",
  email: "email::text",
  displayname: "displayname",
  firstname: "firstname",
  lastname: "lastname",
  department: "department",
  title: "title",
};

const GROUP_QUERY_COLUMNS: Record<string, string> = {
  name: "name",
  description: "description",
};

interface ProxyActionModalProps {
  isModalOpen: boolean;
  closeModal: () => void;
  heading?: string;
  users: User[];
  groups: Group[];
  userAttributes: Attribute[];
  groupAttributes: Attribute[];
  onSelectOwner: (owner: User | Group) => void;
  /**
   * When true, renders inline (no portal / full-screen overlay).
   * Default is modal behavior using a portal.
   */
  inline?: boolean;
}

const ProxyActionModal: React.FC<ProxyActionModalProps> = ({
  isModalOpen,
  closeModal,
  heading = "Proxy Action",
  users,
  groups,
  userAttributes,
  groupAttributes,
  onSelectOwner,
  inline = false,
}) => {
  const [ownerType, setOwnerType] = useState<"User" | "Group">("User");
  const [selectedAttribute, setSelectedAttribute] = useState(
    userAttributes[0].value
  );
  const [searchValue, setSearchValue] = useState("");
  const [appliedSearchValue, setAppliedSearchValue] = useState("");
  const [selectedItem, setSelectedItem] = useState<User | Group | null>(null);
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiGroups, setApiGroups] = useState<Group[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const searchRequestIdRef = useRef(0);

  const sourceData = ownerType === "User" ? apiUsers : apiGroups;
  const currentAttributes =
    ownerType === "User" ? userAttributes : groupAttributes;

  // Server-side results are already filtered by the WHERE clause below, so no client-side filtering needed.
  const filteredData = sourceData;

  // Run the search only when explicitly triggered (Search button / Enter) — queries with a WHERE clause
  // instead of pulling the whole usr / kf_groups table.
  const handleSearch = async () => {
    const term = searchValue.trim();
    setAppliedSearchValue(term);
    setApiError(null);

    if (!term) {
      setApiUsers([]);
      setApiGroups([]);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    const like = `%${term}%`;

    if (ownerType === "User") {
      setIsLoadingUsers(true);
      try {
        const column = USER_QUERY_COLUMNS[selectedAttribute] || "username";
        const query = `SELECT *, userid FROM usr WHERE ${column} ILIKE ? LIMIT 50`;
        const response = await executeQuery<any>(query, [like]);

        let usersData: User[] = [];
        if (response?.resultSet && Array.isArray(response.resultSet)) {
          usersData = response.resultSet.map((user: any) => {
            let emailValue = "";

            if (user.email) {
              if (typeof user.email === "string") {
                emailValue = user.email;
              } else if (user.email.work) {
                emailValue = user.email.work;
              } else if (Array.isArray(user.email) && user.email.length > 0) {
                const primaryEmail = user.email.find((e: any) => e.primary) || user.email[0];
                emailValue = primaryEmail?.value || "";
              }
            }

            // Preserve the internal user identifier (userid/id) so callers
            // can send the correct ID in downstream APIs (e.g., reassign).
            const internalId = user.userid || user.id || user.userUniqueID || "";

            return {
              ...user,
              userid: internalId,
              username: user.username || "",
              email: emailValue,
            };
          });
        }

        if (requestId === searchRequestIdRef.current) {
          setApiUsers(usersData);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        if (requestId === searchRequestIdRef.current) {
          setApiError(error instanceof Error ? error.message : "Failed to search users");
          setApiUsers([]);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoadingUsers(false);
        }
      }
    } else {
      setIsLoadingGroups(true);
      try {
        const column = GROUP_QUERY_COLUMNS[selectedAttribute] || "name";
        const query = `SELECT * FROM kf_groups WHERE ${column} ILIKE ? LIMIT 50`;
        const response = await executeQuery<any>(query, [like]);

        let groupsData: Group[] = [];
        if (response?.resultSet && Array.isArray(response.resultSet)) {
          groupsData = response.resultSet.map((group: any) => ({
            ...group,
            id: group.group_id || group.id || "",
            name: group.group_name || group.name || "",
          }));
        }

        if (requestId === searchRequestIdRef.current) {
          setApiGroups(groupsData);
        }
      } catch (error) {
        console.error("Error searching groups:", error);
        if (requestId === searchRequestIdRef.current) {
          setApiError(error instanceof Error ? error.message : "Failed to search groups");
          setApiGroups([]);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoadingGroups(false);
        }
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClose = () => {
    resetState();
    closeModal(); // call the parent's close function
  };

  const handleCancel = () => {
    resetState();
    closeModal();
  };

  const handleSubmit = () => {
    if (selectedItem) {
      onSelectOwner(selectedItem);
      resetState();
      closeModal();
    }
  };

  const resetState = () => {
    setOwnerType("User");
    setSelectedAttribute(userAttributes[0]?.value || "");
    setSearchValue("");
    setAppliedSearchValue("");
    setSelectedItem(null);
    setApiUsers([]);
    setApiGroups([]);
    setApiError(null);
    setIsLoadingUsers(false);
    setIsLoadingGroups(false);
    searchRequestIdRef.current += 1;
  };

  useEffect(() => {
    if (!isModalOpen) resetState();
  }, [isModalOpen]);

  if (!isModalOpen) {
    return null;
  }

  const card = (
    <div className="bg-white rounded-lg p-4 w-full max-w-[420px] shadow-lg relative">
      {/* Header (hidden for inline usage) */}
      {!inline && (
        <>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <h2 className="text-lg font-semibold mb-4 pr-8">{heading}</h2>
        </>
      )}

      {/* Tabs */}
      <div className="flex mb-4 bg-gray-100 p-1 rounded-md">
        {["User", "Group"].map((type) => (
          <button
            key={type}
            className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors ${
              ownerType === type
                ? "bg-white text-[#15274E] border border-gray-300 shadow-sm relative z-10"
                : "bg-transparent text-gray-500 hover:text-gray-700"
            } rounded-md`}
            onClick={() => {
              setOwnerType(type as "User" | "Group");
              const initialAttr =
                type === "User" ? userAttributes[0] : groupAttributes[0];
              setSelectedAttribute(initialAttr?.value || "");
              setSearchValue("");
              setAppliedSearchValue("");
              setApiUsers([]);
              setApiGroups([]);
              setApiError(null);
              searchRequestIdRef.current += 1;
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Select Attribute */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Attribute
        </label>
        <div className="relative">
          <select
            value={selectedAttribute}
            onChange={(e) => setSelectedAttribute(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8 appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {currentAttributes.map((attr) => (
              <option key={attr.value} value={attr.value}>
                {attr.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Search Value */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search Value
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <button
              type="button"
              onClick={handleSearch}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label="Search"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Filtered List */}
      {appliedSearchValue.trim() !== "" && (
        <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg mb-3 bg-white">
          {(isLoadingUsers && ownerType === "User") || (isLoadingGroups && ownerType === "Group") ? (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Loading {ownerType === "User" ? "users" : "groups"}...</span>
              </div>
            </div>
          ) : apiError ? (
            <p className="text-red-500 italic text-xs p-3">
              Error: {apiError}
            </p>
          ) : filteredData.length === 0 ? (
            <p className="text-gray-500 italic text-sm p-3">
              No results found matching "{appliedSearchValue}" in {selectedAttribute}.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredData.map((item, index) => {
                const isSelected = selectedItem === item;
                const primary =
                  item.username || item.name || item.email || Object.values(item)[0] || "Unknown";
                const secondary =
                  (item.username || item.name) && item.email && item.email !== primary
                    ? item.email
                    : null;
                const initials = primary.toString().slice(0, 2).toUpperCase();

                return (
                  <li
                    key={index}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (inline) {
                        onSelectOwner(item);
                        resetState();
                        closeModal();
                      } else {
                        setSelectedItem(item);
                      }
                    }}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{primary}</div>
                      {secondary && <div className="text-xs text-gray-500 truncate">{secondary}</div>}
                    </div>
                    {isSelected && <CircleCheck size={16} className="text-blue-600 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Action Buttons (hidden for inline usage) */}
      {!inline && (
        <div className="flex justify-end space-x-3 mt-5 pt-4 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedItem}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );

  if (inline) {
    // Render inline (no full-screen overlay / portal)
    return <div className="mt-3">{card}</div>;
  }

  // Default: portal-based modal overlay
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-3">
      {card}
    </div>,
    document.body
  );
};

export default ProxyActionModal;
