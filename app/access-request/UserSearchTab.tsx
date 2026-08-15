"use client";
import React, { useState, useEffect } from "react";
import { Search, Check } from "lucide-react";
import { useSelectedUsers, User } from "@/contexts/SelectedUsersContext";

const UserSearchTab: React.FC = () => {
  const { selectedUsers: contextSelectedUsers, addUser, removeUser } = useSelectedUsers();
  const [searchCriteria, setSearchCriteria] = useState("name");
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Sync local selected IDs with context
  useEffect(() => {
    const ids = new Set(contextSelectedUsers.map((u) => u.id));
    setLocalSelectedIds(ids);
  }, [contextSelectedUsers]);

  const searchOptions = [
    { label: "Name", value: "name" },
    { label: "Email", value: "email" },
    { label: "Username", value: "username" },
    { label: "Employee ID", value: "employee_id" },
    { label: "Department", value: "department" },
    { label: "Job Title", value: "job_title" },
  ];

  // API call to search users
  const handleSearch = async () => {
    if (!searchValue.trim()) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      // Build query to get all users with specified fields
      const query = `SELECT firstname, lastname, email, username, employeeid, department, title,userid FROM usr`;

      const response = await fetch(
        "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: query,
            parameters: [],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log("API Response:", data);
      
      // Handle the response format - data is in resultSet
      let usersData: any[] = [];
      if (data?.resultSet && Array.isArray(data.resultSet)) {
        // Normalize the email field from different formats
        usersData = data.resultSet.map((user: any) => {
          let emailValue = "";
          
          // Handle email field - can be object, array, or missing
          if (user.email) {
            if (typeof user.email === "string") {
              emailValue = user.email;
            } else if (user.email.work) {
              // Format: { "work": "email@example.com" }
              emailValue = user.email.work;
            } else if (Array.isArray(user.email) && user.email.length > 0) {
              // Format: [{ "type": "work", "value": "email@example.com", "primary": true }]
              // Find primary email or first email
              const primaryEmail = user.email.find((e: any) => e.primary) || user.email[0];
              emailValue = primaryEmail?.value || "";
            }
          }
          
          // Construct name from firstname and lastname
          let nameValue = "";
          if (user.firstname || user.lastname) {
            const firstName = user.firstname || "";
            const lastName = user.lastname || "";
            nameValue = `${firstName} ${lastName}`.trim();
          } else {
            nameValue = user.username || "";
          }
          
          return {
            name: nameValue,
            email: emailValue,
            username: user.username || "",
            userid: (user.userid || "").toString(),
            employeeid: (user.employeeid || "").toString(),
            department: user.department || "",
            jobtitle: user.title || "",
          };
        });
      }

      // Convert to User format expected by the component
      const normalizedUsers: User[] = usersData.map((user, index) => ({
        // Keep the true backend identifier so submit payload can pass beneficiary userId.
        id: user.userid || `user-${index}-${user.username || user.email || index}`,
        name: user.name || user.username || "",
        email: user.email,
        username: user.username,
        department: user.department || "",
        jobTitle: user.jobtitle || "",
        employeeId: user.employeeid || undefined,
      }));

      console.log("Normalized users:", normalizedUsers);
      console.log("Search criteria:", searchCriteria, "Search value:", searchValue);
      
      setAllUsers(normalizedUsers);

      // Filter client-side based on search criteria and value
      const filteredUsers = normalizedUsers.filter((user) => {
        const searchLower = searchValue.toLowerCase().trim();
        if (!searchLower) return false;
        
        // Get all searchable fields as a combined string for fallback
        const allFields = [
          user.name || "",
          user.email || "",
          user.username || "",
          user.employeeId || "",
          user.department || "",
          user.jobTitle || "",
        ].join(" ").toLowerCase();
        
        // Map search criteria to specific user fields
        let searchFields: string[] = [];
        
        switch (searchCriteria) {
          case "name":
            searchFields = [user.name?.toLowerCase() || ""];
            break;
          case "email":
            searchFields = [user.email?.toLowerCase() || ""];
            break;
          case "username":
            searchFields = [user.username?.toLowerCase() || ""];
            break;
          case "employee_id":
            searchFields = [user.employeeId?.toLowerCase() || ""];
            break;
          case "department":
            searchFields = [user.department?.toLowerCase() || ""];
            break;
          case "job_title":
            searchFields = [user.jobTitle?.toLowerCase() || ""];
            break;
          default:
            // Fallback: search in all fields
            searchFields = [allFields];
        }
        
        // Check if search value is found in any of the relevant fields
        return searchFields.some(field => field && field.includes(searchLower));
      });

      console.log("Filtered users:", filteredUsers);
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error("Error fetching users from API:", error);
      setSearchError(error instanceof Error ? error.message : "Failed to fetch users");
      setSearchResults([]);
      setAllUsers([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSelect = (user: User) => {
    if (localSelectedIds.has(user.id)) {
      removeUser(user.id);
    } else {
      addUser(user);
    }
  };

  const handleSelectAll = () => {
    if (localSelectedIds.size === searchResults.length) {
      searchResults.forEach((user) => removeUser(user.id));
    } else {
      searchResults.forEach((user) => addUser(user));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4">
        {/* Dropdown */}
        <div className="relative w-64">
          <select
            value={searchCriteria}
            onChange={(e) => setSearchCriteria(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-700"
          >
            {searchOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Input Box */}
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Enter ${searchOptions.find((opt) => opt.value === searchCriteria)?.label || "search value"}...`}
          className="w-64 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!searchValue.trim() || isSearching}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            searchValue.trim() && !isSearching
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isSearching ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search
            </>
          )}
        </button>
      </div>

      {/* Search Results */}
      {isSearching && (
        <div className="mt-6 p-4 text-center text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            Searching...
          </div>
        </div>
      )}

      {/* Error Message */}
      {!isSearching && searchError && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">
            Error: {searchError}
          </p>
        </div>
      )}

      {!isSearching && !searchError && searchResults.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Search Results ({searchResults.length})
            </h3>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {localSelectedIds.size === searchResults.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {searchResults.map((user) => {
                const isSelected = localSelectedIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`flex items-center gap-3 p-4 border-b border-gray-200 last:border-b-0 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 border-l-4 border-l-blue-600"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <span className="text-xs text-gray-500">({user.username})</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{user.department}</span>
                        <span>•</span>
                        <span>{user.jobTitle}</span>
                        {user.employeeId && (
                          <>
                            <span>•</span>
                            <span>ID: {user.employeeId}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!isSearching && !searchError && hasSearched && searchResults.length === 0 && (
        <div className="mt-6 p-4 text-center text-gray-500 border border-gray-200 rounded-md">
          No results found for "{searchValue}" in {searchOptions.find((opt) => opt.value === searchCriteria)?.label || searchCriteria}
        </div>
      )}
    </div>
  );
};

export default UserSearchTab;

