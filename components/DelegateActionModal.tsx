import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { executeQuery } from "@/lib/api";

type Attribute = {
  value: string;
  label: string;
};

type User = Record<string, string>;
type Group = Record<string, string>;

interface DelegateActionModalProps {
  isModalOpen: boolean;
  closeModal: () => void;
  heading?: string;
  users: User[];
  groups: Group[];
  userAttributes: Attribute[];
  groupAttributes: Attribute[];
  onSelectDelegate: (delegate: User | Group) => void;
}

const DelegateActionModal: React.FC<DelegateActionModalProps> = ({
  isModalOpen,
  closeModal,
  heading = "Delegate Action",
  users,
  groups,
  userAttributes,
  groupAttributes,
  onSelectDelegate,
}) => {
  const [delegateType, setDelegateType] = useState<"User" | "Group">("User");
  const [selectedAttribute, setSelectedAttribute] = useState(
    userAttributes[0].value
  );
  const [searchValue, setSearchValue] = useState("");
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiGroups, setApiGroups] = useState<Group[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasFetchedUsersRef = useRef<boolean>(false);
  const hasFetchedGroupsRef = useRef<boolean>(false);
  const isUsersFetchInProgressRef = useRef<boolean>(false);
  const isGroupsFetchInProgressRef = useRef<boolean>(false);

  // Fetch users and groups once when the modal opens
  useEffect(() => {
    if (!isModalOpen) {
      hasFetchedUsersRef.current = false;
      hasFetchedGroupsRef.current = false;
      isUsersFetchInProgressRef.current = false;
      isGroupsFetchInProgressRef.current = false;
      return;
    }

    const fetchUsersOnOpen = async () => {
      if (hasFetchedUsersRef.current || isUsersFetchInProgressRef.current) {
        return;
      }

      setIsLoadingUsers(true);
      setApiError(null);
      isUsersFetchInProgressRef.current = true;

      try {
        const query = `SELECT *, userid FROM usr`;
        const response = await executeQuery<any>(query, []);

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
                const primaryEmail =
                  user.email.find((e: any) => e.primary) || user.email[0];
                emailValue = primaryEmail?.value || "";
              }
            }

            const internalId = user.userid || user.id || user.userUniqueID || "";

            return {
              ...user,
              userid: internalId,
              username: user.username || "",
              email: emailValue,
            };
          });
        }

        setApiUsers(usersData);
        hasFetchedUsersRef.current = true;
      } catch (error) {
        console.error("Error fetching users for delegate:", error);
        setApiError(
          error instanceof Error ? error.message : "Failed to fetch users"
        );
      } finally {
        setIsLoadingUsers(false);
        isUsersFetchInProgressRef.current = false;
      }
    };

    const fetchGroupsOnOpen = async () => {
      if (hasFetchedGroupsRef.current || isGroupsFetchInProgressRef.current) {
        return;
      }

      setIsLoadingGroups(true);
      isGroupsFetchInProgressRef.current = true;

      try {
        const query = `SELECT * FROM kf_groups`;
        const response = await executeQuery<any>(query, []);

        let groupsData: Group[] = [];
        if (response?.resultSet && Array.isArray(response.resultSet)) {
          groupsData = response.resultSet.map((group: any) => ({
            ...group,
            id: group.group_id || group.id || "",
            name: group.group_name || group.name || "",
          }));
        }

        setApiGroups(groupsData);
        hasFetchedGroupsRef.current = true;
      } catch (error) {
        console.error("Error fetching groups for delegate:", error);
        setApiError(
          error instanceof Error ? error.message : "Failed to fetch groups"
        );
      } finally {
        setIsLoadingGroups(false);
        isGroupsFetchInProgressRef.current = false;
      }
    };

    Promise.all([fetchUsersOnOpen(), fetchGroupsOnOpen()]).catch((error) => {
      console.error("Error in delegate parallel fetch:", error);
    });
  }, [isModalOpen]);

  const sourceData =
    delegateType === "User"
      ? (apiUsers.length > 0 ? apiUsers : users)
      : (apiGroups.length > 0 ? apiGroups : groups);
  const currentAttributes =
    delegateType === "User" ? userAttributes : groupAttributes;

  const filteredData =
    searchValue.trim() === ""
      ? []
      : sourceData.filter((item) => {
          const value = item[selectedAttribute];
          return value?.toLowerCase().includes(searchValue.toLowerCase());
        });

  const getDisplayLabel = (item: User | Group) => {
    const name =
      (item as any).displayName ||
      (item as any).name ||
      (item as any).username ||
      "";
    const email =
      (item as any).email ||
      (item as any).workEmail ||
      (item as any).mail ||
      "";
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return Object.values(item)[0] ?? "";
  };

  const handleClose = () => {
    resetState();
    closeModal(); // call the parent's close function
  };

  const resetState = () => {
    setDelegateType("User");
    setSelectedAttribute(userAttributes[0]?.value || "");
    setSearchValue("");
    setApiUsers([]);
    setApiGroups([]);
    setApiError(null);
    setIsLoadingUsers(false);
    setIsLoadingGroups(false);
    hasFetchedUsersRef.current = false;
    hasFetchedGroupsRef.current = false;
    isUsersFetchInProgressRef.current = false;
    isGroupsFetchInProgressRef.current = false;
  };

    const handleCancel = () => {
    resetState();
    closeModal();
  };

  const handleSubmit = () => {
    if (searchValue) {
      onSelectDelegate(delegateType);
      resetState();
      closeModal();
    }
  };

  // Reset API groups when switching between User and Group
  useEffect(() => {
    setApiError(null);
  }, [delegateType]);

  useEffect(() => {
    if (!isModalOpen) resetState();
  }, [isModalOpen]);
  return (
    <>
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-3">
            <div className="bg-white rounded-lg p-4 w-[420px] shadow-lg relative">
              {/* Close button */}
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

              {/* Tabs */}
              <div className="flex mb-4 bg-gray-100 p-1 rounded-md">
                {["User", "Group"].map((type) => (
                  <button
                    key={type}
                    className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors ${
                      delegateType === type
                        ? "bg-white text-[#15274E] border border-gray-300 shadow-sm relative z-10"
                        : "bg-transparent text-gray-500 hover:text-gray-700"
                    } rounded-md`}
                    onClick={() => {
                      setDelegateType(type as "User" | "Group");
                      const initialAttr =
                        type === "User"
                          ? userAttributes[0]
                          : groupAttributes[0];
                      setSelectedAttribute(initialAttr?.value || "");
                      setSearchValue("");
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Select Attribute */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Attribute</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Value</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search"
                  />
                </div>
              </div>

              {/* Filtered List */}
              {searchValue.trim() !== "" && (
                <div className="max-h-36 overflow-auto border rounded p-2 mb-3 text-sm bg-gray-50">
                  {isLoadingGroups && delegateType === "Group" ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="flex items-center gap-2 text-gray-500">
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
                        <span>Loading groups...</span>
                      </div>
                    </div>
                  ) : apiError && delegateType === "Group" ? (
                    <p className="text-red-500 italic text-xs py-2">
                      Error: {apiError}
                    </p>
                  ) : filteredData.length === 0 && delegateType === "Group" && apiGroups.length > 0 ? (
                    <p className="text-gray-500 italic">
                      No results found matching "{searchValue}" in {selectedAttribute}.
                      <br />
                      <span className="text-xs">
                        (Found {apiGroups.length} total groups)
                      </span>
                    </p>
                  ) : filteredData.length === 0 ? (
                    <p className="text-gray-500 italic">No results found.</p>
                  ) : (
                    <ul className="space-y-1">
                      {filteredData.map((item, index) => (
                        <li
                          key={index}
                          className="p-2 border rounded hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                            onSelectDelegate(item);
                            resetState(); // reset internal state
                          }}
                        >
                          {getDisplayLabel(item)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
                            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCancel}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!searchValue}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Submit
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default DelegateActionModal;
