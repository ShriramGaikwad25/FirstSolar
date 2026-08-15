"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUser, getReviewerId, apiRequestWithAuth } from "@/lib/auth";

export default function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user: authUser, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const currentUserId = authUser?.email || getCurrentUser()?.email;
    const reviewerId = getReviewerId();
    let userIdFromCookie: string | null = null;
    try {
      const uidTenant = getCurrentUser();
      if (uidTenant && typeof uidTenant === "object" && "userid" in uidTenant) {
        userIdFromCookie = (uidTenant as { userid?: string }).userid ?? null;
      }
    } catch {
      // ignore
    }
    const searchIdentifier = userIdFromCookie || currentUserId;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const endpoint = "https://preview.keyforge.ai/entities/api/v1/ACMECOM/executeQuery";
        const responseData = await apiRequestWithAuth<any>(endpoint, {
          method: "POST",
          body: JSON.stringify({ query: "SELECT * FROM usr", parameters: [] }),
        });

        const sourceArray: any[] =
          responseData && typeof responseData === "object" && "resultSet" in responseData && Array.isArray((responseData as any).resultSet)
            ? (responseData as any).resultSet
            : Array.isArray(responseData)
              ? responseData
              : [];

        if (sourceArray.length === 0) {
          setError("No user data found.");
          return;
        }

        const searchIdLower = (searchIdentifier || "").toLowerCase().trim();
        let userData: any = sourceArray.find((u: any) => (u.username || "").toLowerCase().trim() === searchIdLower);
        if (!userData) {
          userData = sourceArray.find((u: any) => {
            const e = u.email?.work || (typeof u.email === "string" ? u.email : "") || u.customattributes?.emails?.[0]?.value || "";
            return e.toLowerCase().trim() === searchIdLower;
          });
        }
        if (!userData && reviewerId) {
          const rLower = reviewerId.toLowerCase().trim();
          userData = sourceArray.find(
            (u: any) => (u.userid || u.id || u.userUniqueID || "").toLowerCase().trim() === rLower
          );
        }
        if (!userData) {
          userData = sourceArray.find((u: any) => (u.displayname || u.displayName || "").toLowerCase().trim() === searchIdLower);
        }
        if (!userData) {
          userData = sourceArray.find(
            (u: any) => `${(u.firstname || "")} ${(u.lastname || "")}`.toLowerCase().trim() === searchIdLower
          );
        }
        if (!userData) {
          userData = sourceArray.find((u: any) => (u.firstname || "").toLowerCase().trim() === searchIdLower);
        }
        if (!userData && searchIdentifier) {
          setError("Your user record was not found.");
          return;
        }
        if (!userData) {
          userData = sourceArray[0];
        }

        const displayName =
          userData.displayname ||
          userData.displayName ||
          `${userData.firstname ?? ""} ${userData.lastname ?? ""}`.trim() ||
          userData.username ||
          "Unknown User";
        const email =
          userData.email?.work ||
          (typeof userData.email === "string" ? userData.email : "") ||
          userData.customattributes?.emails?.[0]?.value ||
          userData.username ||
          searchIdentifier ||
          "no-email@example.com";
        const userId = userData.userid || userData.id || userData.username || userData.customattributes?.id;

        if (!userId) {
          setError("User ID could not be resolved.");
          return;
        }

        localStorage.setItem("selectedUserRawFull", JSON.stringify(userData));
        localStorage.setItem(
          "selectedUserRaw",
          JSON.stringify({
            name: displayName,
            email,
            id: userId,
            userId,
            title: userData.title || userData.customattributes?.title || "",
            department: userData.department || userData.customattributes?.enterpriseUser?.department || "",
            tags: userData.employeetype || userData.customattributes?.userType || "User",
            managerName: userData.managername || userData.customattributes?.enterpriseUser?.manager?.value || "",
          })
        );
        setRedirecting(true);
        router.replace("/user/" + encodeURIComponent(String(userId)));
        return;
      } catch (err) {
        if (err instanceof Error && err.message.includes("No JWT token available")) {
          setIsLoading(false);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [authUser, isAuthenticated, router]);

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center justify-center min-h-[320px]">
        {(isLoading || redirecting) && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">{redirecting ? "Opening your profile…" : "Loading your profile…"}</p>
          </div>
        )}
        {!isLoading && !redirecting && error && (
          <div className="text-center">
            <p className="text-red-600 mb-2">{error}</p>
            <p className="text-gray-500 text-sm">You can use the Back button or go to Users and open your profile from there.</p>
          </div>
        )}
        {!isLoading && !redirecting && !error && !isAuthenticated && (
          <p className="text-gray-600">Please log in to view your profile.</p>
        )}
      </div>
    </>
  );
}
