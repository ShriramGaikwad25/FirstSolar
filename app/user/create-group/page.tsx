"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Check, CircleAlert, CircleCheck, Pencil, Search, UserMinus, X } from "lucide-react";
import { addGroupMembers, createGroup, getGroupById, removeGroupMembers, updateGroup } from "@/lib/api";
import { getReviewerId } from "@/lib/auth";
import { useLeftSidebar } from "@/contexts/LeftSidebarContext";
import CustomPagination from "@/components/agTable/CustomPagination";
import UserPickerModal from "@/components/UserPickerModal";
import Modal from "@/components/Modal";
import {
  User,
  UserFilter,
  buildUserSearchFilter,
  fetchUserPage,
  fetchUsersByIds,
  userSearchOptions as searchOptions,
} from "@/lib/userSearch";

const USER_PAGE_SIZE_OPTIONS = [20, 50, 100];

// GET /groups/{groupId}
interface GroupResponse {
  groupId: string;
  groupCode?: string | null;
  groupName: string;
  description?: string | null;
  groupType?: string | null;
  ownerId?: string | null;
  stewardId?: string | null;
  status?: string | null;
  tags?: string | string[] | null;
  members?: { userId: string; addedAt?: string | null; addedBy?: string | null }[] | null;
}

// "Platform Engineering" -> "PLATFORM_ENGINEERING"
function toGroupCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface FormData {
  step1: {
    groupName: string;
    description: string;
    owner: string;
    ownerId: string;
    tags: string;
    ownerIsReviewer: boolean;
  };
  step2: {
    selectedUsers: string[];
  };
}

export default function CreateUserGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";
  const groupId = searchParams.get("groupId");
  const { isVisible: isSidebarVisible, sidebarWidthPx } = useLeftSidebar();
  const [currentStep, setCurrentStep] = useState(1);
  const [validationStatus, setValidationStatus] = useState<boolean[]>([
    false,
    false,
    false,
  ]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    step1: {
      groupName: "",
      description: "",
      owner: "",
      ownerId: "",
      tags: "",
      ownerIsReviewer: false,
    },
    step2: {
      selectedUsers: [],
    },
  });

  // Group as loaded for edit; its other fields are sent back unchanged on update
  const [loadedGroup, setLoadedGroup] = useState<GroupResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false);
  // Result pop-up after Submit / Save Changes
  const [notice, setNotice] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  // In edit mode Step 2 starts on the current members; the full user list opens on "Edit"
  const [isEditingMembers, setIsEditingMembers] = useState(!isEditMode);

  const steps = [
    { id: 1, title: "Group Details" },
    { id: 2, title: "Select Users" },
    { id: 3, title: "Review & Submit" },
  ];

  // Every user seen in any result, so selections from earlier searches keep their details
  const [knownUsers, setKnownUsers] = useState<Record<string, User>>({});

  // Prefill the form in edit mode: fetch the group by id, falling back to the
  // row the User Groups table stored before navigating here.
  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;

    const loadStoredGroup = () => {
      try {
        const stored = localStorage.getItem("selectedUserGroup");
        if (!stored) return;
        const group = JSON.parse(stored);
        setFormData((prev) => ({
          ...prev,
          step1: {
            ...prev.step1,
            groupName: group.userGroup ?? group.groupName ?? "",
            description: group.description ?? "",
            owner: group.owner ?? "",
            tags: group.tags ?? "",
          },
        }));
      } catch (err) {
        console.error("Error loading group for edit:", err);
      }
    };

    const loadGroup = async () => {
      if (!groupId) {
        loadStoredGroup();
        return;
      }
      try {
        const group = await getGroupById<GroupResponse>(groupId);
        if (cancelled) return;
        setLoadedGroup(group);

        // Owner and members come back as user ids; resolve them to users
        const ownerId = group.ownerId ?? undefined;
        const memberIds = (group.members ?? []).map((m) => m.userId).filter(Boolean);
        let resolved: User[] = [];
        try {
          resolved = await fetchUsersByIds(Array.from(new Set([...(ownerId ? [ownerId] : []), ...memberIds])));
        } catch (err) {
          console.error("Error resolving group owner/members:", err);
        }
        if (cancelled) return;
        const byId = new Map(resolved.map((u) => [u.userId, u]));
        const owner = ownerId ? byId.get(ownerId) : undefined;
        const members = memberIds.map((id) => byId.get(id)).filter((u): u is User => Boolean(u));
        const memberEmails = members.map((u) => u.email);
        if (resolved.length > 0) {
          setKnownUsers((prev) => {
            const next = { ...prev };
            resolved.forEach((u) => (next[u.email] = u));
            return next;
          });
        }

        setFormData((prev) => ({
          ...prev,
          step1: {
            ...prev.step1,
            groupName: group.groupName ?? "",
            description: group.description ?? "",
            owner: owner?.username || owner?.email || ownerId || "",
            ownerId: ownerId ?? "",
            tags: Array.isArray(group.tags) ? group.tags.join(", ") : group.tags ?? "",
          },
          step2:
            memberEmails.length > 0
              ? { ...prev.step2, selectedUsers: memberEmails }
              : prev.step2,
        }));
      } catch (err) {
        console.error("Error fetching group for edit:", err);
        if (!cancelled) loadStoredGroup();
      }
    };

    loadGroup();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, groupId]);

  const [searchCriteria, setSearchCriteria] = useState("name");
  const [searchValue, setSearchValue] = useState("");
  const [appliedSearch, setAppliedSearch] = useState<{ criteria: string; value: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Server-side pagination of the user list (initial list or the active search)
  const initialUserFilter: UserFilter = { where: " WHERE lower(department) = ?", params: ["operations"] };
  const [userFilter, setUserFilter] = useState<UserFilter>(initialUserFilter);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(USER_PAGE_SIZE_OPTIONS[0]);
  const [totalUsers, setTotalUsers] = useState(0);
  const totalUserPages = Math.max(1, Math.ceil(totalUsers / userPageSize));

  const loadUserPage = async (filter: UserFilter, page: number, pageSize: number) => {
    const { users: list, total } = await fetchUserPage(filter, page, pageSize);
    setPinnedUsers(formData.step2.selectedUsers);
    setKnownUsers((prev) => {
      const next = { ...prev };
      list.forEach((u) => (next[u.email] = u));
      return next;
    });
    setUsers(list);
    setTotalUsers(total);
    setUserFilter(filter);
    setUserPage(page);
    setUserPageSize(pageSize);
  };

  // Runs a list load with the shared loading/error handling
  const runUserLoad = async (filter: UserFilter, page: number, pageSize: number) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      await loadUserPage(filter, page, pageSize);
      return true;
    } catch (err) {
      console.error("Error fetching users:", err);
      setSearchError(err instanceof Error ? err.message : "Failed to fetch users");
      setUsers([]);
      setTotalUsers(0);
      return false;
    } finally {
      setIsSearching(false);
    }
  };

  // Initial user list
  useEffect(() => {
    const loadInitialUsers = async () => {
      try {
        setLoading(true);
        await loadUserPage(initialUserFilter, 1, userPageSize);
      } catch (err) {
        console.error("Error fetching users:", err);
        setUsers([]);
        setTotalUsers(0);
      } finally {
        setLoading(false);
      }
    };

    loadInitialUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    const value = searchValue.trim();
    if (!value) return;
    if (await runUserLoad(buildUserSearchFilter(searchCriteria, value), 1, userPageSize)) {
      setAppliedSearch({ criteria: searchCriteria, value });
    }
  };

  // Validate Step 1
  useEffect(() => {
    const isValid =
      formData.step1.groupName.trim() !== "" &&
      formData.step1.description.trim() !== "" &&
      formData.step1.owner.trim() !== "";
    setValidationStatus((prev) => {
      const newStatus = [...prev];
      newStatus[0] = isValid;
      return newStatus;
    });
  }, [formData.step1]);

  const setSelectedUsers = (selectedUsers: string[]) =>
    setFormData((prev) => ({ ...prev, step2: { ...prev.step2, selectedUsers } }));

  const toggleUser = (email: string) =>
    setFormData((prev) => {
      const current = prev.step2.selectedUsers;
      const selectedUsers = current.includes(email)
        ? current.filter((e) => e !== email)
        : [...current, email];
      return { ...prev, step2: { ...prev.step2, selectedUsers } };
    });

  // Users selected when the list was loaded are pinned to the top of page 1 (and left out
  // of the server pages); taken as a snapshot so rows don't jump while ticking
  const [pinnedUsers, setPinnedUsers] = useState<string[]>([]);
  const pinnedSet = new Set(pinnedUsers);
  const displayUsers: User[] = [
    ...(userPage === 1 ? pinnedUsers.map((email) => knownUsers[email]).filter((u): u is User => Boolean(u)) : []),
    ...users.filter((u) => !pinnedSet.has(u.email)),
  ];

  const allResultsSelected =
    displayUsers.length > 0 && displayUsers.every((u) => formData.step2.selectedUsers.includes(u.email));

  const toggleAllResults = () => {
    const resultEmails = displayUsers.map((u) => u.email);
    setFormData((prev) => {
      const current = prev.step2.selectedUsers;
      const selectedUsers = allResultsSelected
        ? current.filter((e) => !resultEmails.includes(e))
        : Array.from(new Set([...current, ...resultEmails]));
      return { ...prev, step2: { ...prev.step2, selectedUsers } };
    });
  };

  const tagList = formData.step1.tags.split(",").map((tag) => tag.trim()).filter(Boolean);

  // Validate Step 2
  useEffect(() => {
    const isValid = formData.step2.selectedUsers.length > 0;
    setValidationStatus((prev) => {
      const newStatus = [...prev];
      newStatus[1] = isValid;
      return newStatus;
    });
  }, [formData.step2]);

  // Step 3 is always valid if we reach it
  useEffect(() => {
    if (currentStep === 3) {
      setValidationStatus((prev) => {
        const newStatus = [...prev];
        newStatus[2] = true;
        return newStatus;
      });
    }
  }, [currentStep]);

  const handleNext = () => {
    if (validationStatus[currentStep - 1] && currentStep < steps.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (isEditMode && !(groupId && loadedGroup)) {
        setNotice({
          type: "error",
          title: "Group not loaded",
          message: "This group could not be loaded, so it can't be updated. Please reopen it from the User Groups list.",
        });
        return;
      }

      const memberIds = formData.step2.selectedUsers
        .map((email) => knownUsers[email]?.userId)
        .filter((id): id is string => Boolean(id));
      if (!isEditMode && memberIds.length !== formData.step2.selectedUsers.length) {
        setNotice({
          type: "error",
          title: "Some users couldn't be matched",
          message: "Some selected users could not be matched to a user id. Please reselect them and try again.",
        });
        return;
      }

      const ownerId = formData.step1.ownerId || null;

      const groupName = formData.step1.groupName.trim();
      const description = formData.step1.description.trim();
      const tags = formData.step1.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const members = memberIds.map((userId) => ({ userId }));

      if (isEditMode && groupId && loadedGroup) {
        const actorId = getReviewerId();

        // Details only; membership is saved separately via Done / remove
        await updateGroup(groupId, {
          ...loadedGroup,
          groupName,
          description,
          ownerId,
          tags,
          actorId,
        });
      } else {
        // POST /groups: members go in `users`
        await createGroup({
          groupCode: toGroupCode(groupName),
          groupName,
          description,
          ownerId,
          stewardId: null,
          status: "ACTIVE",
          source: "MANUAL",
          tags,
          metadata: {},
          actorId: getReviewerId(),
          users: members,
        });
      }

      setNotice({
        type: "success",
        title: isEditMode ? "Group updated" : "Group created",
        message: isEditMode
          ? `"${groupName}" has been updated successfully.`
          : `"${groupName}" has been created successfully.`,
      });
    } catch (error) {
      console.error("Error saving user group:", error);
      setNotice({
        type: "error",
        title: isEditMode ? "Couldn't update group" : "Couldn't create group",
        message:
          error instanceof Error && error.message
            ? error.message
            : "An error occurred while saving the user group. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit mode: saves membership changes against the members currently stored on the group
  const [isSavingMembers, setIsSavingMembers] = useState(false);

  const saveMemberChanges = async (selectedEmails: string[]): Promise<boolean> => {
    if (!groupId || !loadedGroup) {
      setNotice({
        type: "error",
        title: "Group not loaded",
        message: "This group could not be loaded, so its members can't be changed. Please reopen it from the User Groups list.",
      });
      return false;
    }

    const selectedIds = selectedEmails.map((email) => knownUsers[email]?.userId);
    if (selectedIds.some((id) => !id)) {
      setNotice({
        type: "error",
        title: "Some users couldn't be matched",
        message: "Some selected users could not be matched to a user id. Please reselect them and try again.",
      });
      return false;
    }

    const ids = selectedIds as string[];
    const storedIds = new Set((loadedGroup.members ?? []).map((m) => m.userId));
    const selectedSet = new Set(ids);
    const toAdd = ids.filter((id) => !storedIds.has(id));
    const toRemove = Array.from(storedIds).filter((id) => !selectedSet.has(id));
    if (toAdd.length === 0 && toRemove.length === 0) return true;

    setIsSavingMembers(true);
    try {
      const actorId = getReviewerId();
      if (toAdd.length > 0) await addGroupMembers(groupId, toAdd, actorId);
      if (toRemove.length > 0) await removeGroupMembers(groupId, toRemove, actorId);
      setLoadedGroup((prev) => (prev ? { ...prev, members: ids.map((userId) => ({ userId })) } : prev));
      return true;
    } catch (error) {
      console.error("Error saving group members:", error);
      setNotice({
        type: "error",
        title: "Couldn't update members",
        message:
          error instanceof Error && error.message
            ? error.message
            : "An error occurred while saving the group members. Please try again.",
      });
      return false;
    } finally {
      setIsSavingMembers(false);
    }
  };

  // Discards unsaved member edits: back to the members stored on the group
  const handleMembersCancel = () => {
    const emailById = new Map(Object.values(knownUsers).map((u) => [u.userId, u.email]));
    const storedEmails = (loadedGroup?.members ?? [])
      .map((m) => emailById.get(m.userId))
      .filter((email): email is string => Boolean(email));
    setSelectedUsers(storedEmails);
    setIsEditingMembers(false);
  };

  const handleMembersDone = async () => {
    if (await saveMemberChanges(formData.step2.selectedUsers)) setIsEditingMembers(false);
  };

  // Members view in edit mode asks for confirmation, then removes right away;
  // elsewhere it only updates the selection
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const handleRemoveMember = (email: string) => {
    if (!isEditMode || isEditingMembers) {
      toggleUser(email);
      return;
    }
    setPendingRemoval(email);
  };

  const confirmRemoveMember = async () => {
    if (!pendingRemoval) return;
    const remaining = formData.step2.selectedUsers.filter((e) => e !== pendingRemoval);
    const removed = await saveMemberChanges(remaining);
    setPendingRemoval(null);
    if (removed) setSelectedUsers(remaining);
  };

  const closeNotice = () => {
    const wasSuccess = notice?.type === "success";
    setNotice(null);
    if (wasSuccess) router.push("/user?tab=groups");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  const membersTable =
    formData.step2.selectedUsers.length === 0 ? (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-gray-500">No users selected.</p>
        <button
          type="button"
          onClick={() => {
            setIsEditingMembers(true);
            setCurrentStep(2);
          }}
          className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Select users
        </button>
      </div>
    ) : (
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-blue-50">
            <tr className="border-b border-blue-100 text-xs font-semibold uppercase tracking-wider text-blue-800">
              <th className="px-5 py-2.5 font-semibold">Name</th>
              <th className="px-5 py-2.5 font-semibold">Email</th>
              <th className="hidden px-5 py-2.5 font-semibold md:table-cell">Department</th>
              <th className="hidden px-5 py-2.5 font-semibold lg:table-cell">Job Title</th>
              <th className="w-12 px-5 py-2.5"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {formData.step2.selectedUsers.map((email) => {
              const user = knownUsers[email];
              return (
                <tr key={email} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{user?.name || email}</div>
                    {user?.username && <div className="text-xs text-gray-500">{user.username}</div>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{email}</td>
                  <td className="hidden px-5 py-3 text-gray-600 md:table-cell">{user?.department || "—"}</td>
                  <td className="hidden px-5 py-3 text-gray-600 lg:table-cell">{user?.title || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(email)}
                      disabled={isSavingMembers}
                      aria-label={`Remove ${user?.name || email}`}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Fixed step bar below header; aligned with content area */}
      <div
        className="fixed top-[60px] z-20 bg-white border-b border-gray-200 shadow-sm px-6 py-4"
        style={{
          left: isSidebarVisible ? sidebarWidthPx : 0,
          right: 0,
          transition: "left 300ms ease-in-out",
        }}
      >
        {isEditMode ? (
          <div className="flex h-10 items-center gap-4 max-w-full">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-gray-900">
                Edit User Group
                {loadedGroup?.groupName && (
                  <span className="font-normal text-gray-500"> · {loadedGroup.groupName}</span>
                )}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => router.push("/user?tab=groups")}
              className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!validationStatus[0] || isSubmitting || isEditingMembers || isSavingMembers}
              title={isEditingMembers ? "Click Done to save member changes first" : undefined}
              className="flex shrink-0 items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 mr-2" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
        <div className="flex items-center gap-4 max-w-full">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium shrink-0 ${
                currentStep === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </button>

            <div className="flex-1 flex items-center min-w-0">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border shrink-0 ${
                        currentStep >= step.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300"
                      }`}
                    >
                      {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-0.5 bg-gray-200 mx-4 min-w-[16px]" aria-hidden />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="shrink-0">
              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={!validationStatus[currentStep - 1]}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                    !validationStatus[currentStep - 1]
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!validationStatus[0] || !validationStatus[1] || isSubmitting}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Saving..." : "Submit"}
                </button>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Spacer so content is not hidden under fixed step bar */}
        <div className="h-[72px]" aria-hidden />

        <div className="w-full pt-2 pb-8 px-4">
        {/* Form Content */}
        <div className="bg-white rounded-2xl border border-[#EEF0F2] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_14px_rgba(16,24,40,0.035)] p-6 mb-6 sm:p-8">
          {(isEditMode || currentStep === 1) && (
          <div className="space-y-6">
            {isEditMode && <h2 className="text-base font-semibold text-gray-900">Group Details</h2>}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <div>
                <label htmlFor="groupName" className="mb-1.5 block text-sm font-medium text-gray-700">
                  User Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="groupName"
                  type="text"
                  value={formData.step1.groupName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, groupName: e.target.value },
                    }))
                  }
                  placeholder="e.g. Operations - Managers"
                  className="block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="owner" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Owner <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    id="owner"
                    type="button"
                    onClick={() => setIsOwnerPickerOpen(true)}
                    className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 pl-3.5 pr-16 text-left text-sm shadow-sm hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                  >
                    <span className={`truncate ${formData.step1.owner ? "text-gray-900" : "text-gray-400"}`}>
                      {formData.step1.owner || "Search and select an owner"}
                    </span>
                  </button>
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {formData.step1.owner && (
                      <button
                        type="button"
                        aria-label="Clear owner"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            step1: { ...prev.step1, owner: "", ownerId: "" },
                          }))
                        }
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Search owner"
                      onClick={() => setIsOwnerPickerOpen(true)}
                      className="rounded p-1 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <UserPickerModal
                  open={isOwnerPickerOpen}
                  title="Select Owner"
                  selectedUserId={formData.step1.ownerId || null}
                  onClose={() => setIsOwnerPickerOpen(false)}
                  onSelect={(user) => {
                    setFormData((prev) => ({
                      ...prev,
                      step1: {
                        ...prev.step1,
                        owner: user.username || user.email,
                        ownerId: user.userId || "",
                      },
                    }));
                    setIsOwnerPickerOpen(false);
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={formData.step1.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    step1: { ...prev.step1, description: e.target.value },
                  }))
                }
                rows={4}
                placeholder="What is this group used for?"
                className="block w-full min-w-0 resize-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 sm:items-end">
              <div>
                <label htmlFor="tags" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <input
                  id="tags"
                  type="text"
                  value={formData.step1.tags}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, tags: e.target.value },
                    }))
                  }
                  placeholder="e.g. Operations, Finance"
                  className="block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
                />
              </div>

              <label
                htmlFor="ownerIsReviewer"
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  id="ownerIsReviewer"
                  checked={formData.step1.ownerIsReviewer}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      step1: { ...prev.step1, ownerIsReviewer: e.target.checked },
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Owner is Reviewer</span>
              </label>
            </div>
          </div>
        )}

        {(isEditMode || currentStep === 2) && (
          <div className={`space-y-6 ${isEditMode ? "mt-8 border-t border-gray-200 pt-8" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {isEditMode ? (
                <h2 className="text-base font-semibold text-gray-900">
                  Members <span className="text-red-500">*</span>
                </h2>
              ) : (
                <h2 className="text-sm font-medium text-gray-700">
                  Select Users <span className="text-red-500">*</span>
                </h2>
              )}
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {formData.step2.selectedUsers.length} selected
                </span>
                {isEditMode && isEditingMembers && (
                  <button
                    type="button"
                    onClick={handleMembersCancel}
                    disabled={isSavingMembers}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                )}
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingMembers) {
                        handleMembersDone();
                      } else {
                        setPinnedUsers(formData.step2.selectedUsers);
                        setIsEditingMembers(true);
                      }
                    }}
                    disabled={isSavingMembers}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                      isEditingMembers
                        ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                        : "border-gray-300 bg-white text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    {isEditingMembers ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        {isSavingMembers ? "Saving..." : "Done"}
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {!isEditingMembers && (
              <div className="overflow-hidden rounded-xl border border-gray-200">{membersTable}</div>
            )}

            {isEditingMembers && (
            <>

            <div className="flex flex-wrap items-center gap-4">
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
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>

              {/* Input Box */}
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder={`Enter ${searchOptions.find((opt) => opt.value === searchCriteria)?.label || "search value"}...`}
                className="w-64 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />

              {/* Search Button */}
              <button
                type="button"
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

            {isSearching && (
              <div className="p-4 text-center text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </div>
              </div>
            )}

            {!isSearching && searchError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">Error: {searchError}</p>
              </div>
            )}

            {!isSearching && !searchError && displayUsers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {appliedSearch ? "Search Results" : "Users"} ({totalUsers})
                  </h3>
                  <button
                    type="button"
                    onClick={toggleAllResults}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {allResultsSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {displayUsers.map((user) => {
                      const isSelected = formData.step2.selectedUsers.includes(user.email);
                      return (
                        <div
                          key={user.email}
                          onClick={() => toggleUser(user.email)}
                          className={`flex items-center gap-3 p-4 border-b border-gray-200 last:border-b-0 cursor-pointer transition-colors ${
                            isSelected ? "bg-blue-50 border-l-4 border-l-blue-600" : "hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 border-2 rounded flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{user.name}</p>
                              {user.username && (
                                <span className="text-xs text-gray-500">({user.username})</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              {[
                                user.department,
                                user.title,
                                user.employeeId ? `ID: ${user.employeeId}` : "",
                              ]
                                .filter(Boolean)
                                .map((part, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && <span>•</span>}
                                    <span>{part}</span>
                                  </React.Fragment>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4">
                  <CustomPagination
                    totalItems={totalUsers}
                    currentPage={userPage}
                    totalPages={totalUserPages}
                    pageSize={userPageSize}
                    onPageChange={(page) => runUserLoad(userFilter, page, userPageSize)}
                    onPageSizeChange={(size) => {
                      if (typeof size === "number") runUserLoad(userFilter, 1, size);
                    }}
                    pageSizeOptions={USER_PAGE_SIZE_OPTIONS}
                  />
                </div>
              </div>
            )}

            {!isSearching && !searchError && displayUsers.length === 0 && (
              <div className="p-4 text-center text-gray-500 border border-gray-200 rounded-md">
                {appliedSearch
                  ? `No results found for "${appliedSearch.value}" in ${
                      searchOptions.find((opt) => opt.value === appliedSearch.criteria)?.label || appliedSearch.criteria
                    }`
                  : "No users available"}
              </div>
            )}
            </>
            )}
          </div>
        )}

        {!isEditMode && currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Review your new group
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Check the details below, then submit to create the group.
              </p>
            </div>

            {/* Group details */}
            <section className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
                <h3 className="text-sm font-semibold text-gray-900">Group Details</h3>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              <dl className="divide-y divide-gray-100">
                {[
                  { label: "Group Name", value: <span className="font-medium text-gray-900">{formData.step1.groupName || "—"}</span> },
                  { label: "Owner", value: formData.step1.owner || "—" },
                  {
                    label: "Owner is Reviewer",
                    value: (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          formData.step1.ownerIsReviewer
                            ? "border border-green-200 bg-green-50 text-green-700"
                            : "border border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        {formData.step1.ownerIsReviewer ? "Yes" : "No"}
                      </span>
                    ),
                  },
                  {
                    label: "Description",
                    value: formData.step1.description ? (
                      <span className="whitespace-pre-wrap">{formData.step1.description}</span>
                    ) : (
                      <span className="text-gray-400">No description provided</span>
                    ),
                  },
                  {
                    label: "Tags",
                    value: tagList.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {tagList.map((tag, i) => (
                          <span
                            key={`${tag}-${i}`}
                            className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    ),
                  },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-[200px_1fr] sm:gap-6">
                    <dt className="text-sm text-gray-500">{row.label}</dt>
                    <dd className="text-sm text-gray-700">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Members */}
            <section className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  Members
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {formData.step2.selectedUsers.length}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>

              {membersTable}
            </section>
          </div>
        )}
        </div>
      </div>
      <Modal
        open={pendingRemoval !== null}
        onClose={() => !isSavingMembers && setPendingRemoval(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingRemoval(null)}
              disabled={isSavingMembers}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRemoveMember}
              disabled={isSavingMembers}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingMembers ? "Removing..." : "Remove"}
            </button>
          </>
        }
      >
        {pendingRemoval && (
          <div className="flex flex-col items-center px-2 py-4 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <UserMinus className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">Remove member?</h3>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-gray-900">{knownUsers[pendingRemoval]?.name || pendingRemoval}</span>
              {knownUsers[pendingRemoval]?.name && <> ({pendingRemoval})</>} will be removed from
              {loadedGroup?.groupName ? <> &quot;{loadedGroup.groupName}&quot;</> : " this group"}.
            </p>
          </div>
        )}
      </Modal>
      <Modal
        open={notice !== null}
        onClose={closeNotice}
        footer={
          <button
            type="button"
            onClick={closeNotice}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              notice?.type === "success" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-700 hover:bg-gray-800"
            }`}
          >
            {notice?.type === "success" ? "Back to User Groups" : "Close"}
          </button>
        }
      >
        {notice && (
          <div className="flex flex-col items-center px-2 py-4 text-center">
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                notice.type === "success" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
              }`}
            >
              {notice.type === "success" ? <CircleCheck className="h-6 w-6" /> : <CircleAlert className="h-6 w-6" />}
            </div>
            <h3 className="text-base font-semibold text-gray-900">{notice.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{notice.message}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
