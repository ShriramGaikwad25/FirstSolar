import {
  BellIcon,
  MoreVertical,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ProxyActionModal from "../ProxyActionModal";
import { useLoading } from "@/contexts/LoadingContext";
import ActionCompletedToast from "../ActionCompletedToast";
import { useRouter } from "next/navigation";

interface ChampaignActionButtonProps {
  reviewerId?: string;
  certId?: string;
}

const ChampaignActionButton: React.FC<ChampaignActionButtonProps> = ({
  reviewerId,
  certId,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [copyManager, setCopyManager] = useState(false);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  const { showApiLoader, hideApiLoader } = useLoading();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);

    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom,
        left: rect.left - 128,
      });
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
    setOpen(false); // close dropdown when modal opens
  };

  // Generic action handler for all buttons
  const handleAction = async (actionName: string) => {
    try {
      setIsActionLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // End local loading state quickly (no overlay)
      setTimeout(() => {
        setIsActionLoading(false);
      }, 100);
      
      // Show completion toast immediately
      setShowCompletionToast(true);
      
    } catch (error) {
      console.error(`Error performing ${actionName}:`, error);
      setIsActionLoading(false);
    }
  };

  const handleView = () => {
    if (reviewerId && certId) {
      // Navigate to TreeClient page in read-only mode for this reviewer/certification
      router.push(`/access-review/${reviewerId}/${certId}?readonly=true`);
      return;
    }

    // Fallback to generic handler if identifiers are missing
    handleAction("View");
  };
  
  const handleSendReminder = () => {
    setIsReminderModalOpen(true);
  };

  const handleConfirmReminder = async () => {
    setIsReminderModalOpen(false);
    try {
      setIsActionLoading(true);
      
      // TODO: Implement API call to send reminder email
      // const response = await fetch(
      //   `https://preview.keyforge.ai/certification/api/v1/ACMECOM/sendReminder/${reviewerId}`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({ 
      //       reviewerId,
      //       certId,
      //       copyManager 
      //     }),
      //   }
      // );
      // if (!response.ok) throw new Error("Failed to send reminder");
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // End local loading state quickly (no overlay)
      setTimeout(() => {
        setIsActionLoading(false);
      }, 100);
      
      // Show completion toast
      setShowCompletionToast(true);
      setCopyManager(false); // Reset checkbox
      
      console.log("Reminder sent", { reviewerId, certId, copyManager });
    } catch (error) {
      console.error("Error sending reminder:", error);
      setIsActionLoading(false);
      setCopyManager(false);
    }
  };
  const handleEscalate = () => handleAction('Escalate');
  const handleReassign = () => {
    setIsModalOpen(true);
    setOpen(false); // close dropdown when modal opens
  };
  const handleClaim = () => {
    setIsClaimModalOpen(true);
    setOpen(false); // close dropdown when modal opens
  };

  const handleConfirmClaim = async () => {
    setIsClaimModalOpen(false);
    try {
      setIsActionLoading(true);
      showApiLoader?.(true, "Claiming and reassigning to admin...");
      
      // Reassign to admin - using admin as the default admin user/group
      // You may need to adjust the admin ID based on your system
      const adminId = "admin"; // Default admin ID - adjust as needed
      const adminType = "User"; // or "Group" depending on your setup
      
      const payload = {
        reviewerName: reviewerId || "",
        reviewerId: reviewerId || "",
        certificationId: certId || "",
        taskId: "", // Not available at this level
        lineItemId: "", // Not available at certification level
        assignmentEntity: "Cert",
        newOwnerDetails: {
          id: adminId,
          type: adminType,
        },
        justification: "Claimed and reassigned to admin",
      };

      const response = await fetch(
        `https://preview.keyforge.ai/certification/api/v1/ACMECOM/reassign/${reviewerId}/${certId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Reassign failed: ${response.statusText}`);
      }

      // Success
      setIsActionLoading(false);
      hideApiLoader?.();
      setShowCompletionToast(true);
      
      console.log("Claimed and reassigned to admin", { reviewerId, certId });
    } catch (error) {
      console.error("Error claiming:", error);
      setIsActionLoading(false);
      hideApiLoader?.();
      alert(`Failed to claim and reassign: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  
  const handleTeamsClick = () => {
    // Get reviewer email or use a default - you may need to adjust this based on your data structure
    const reviewerEmail = reviewerId || "Harish.jangada@icallidus.com";
    if (reviewerEmail) {
      const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${reviewerEmail}&topicName=Review&message=Hello`;
      window.open(teamsUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback: open Teams without specific user
      const teamsUrl = `https://teams.microsoft.com/`;
      window.open(teamsUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Generate unique gradient ID for Teams icon
  const gradientId = `teams-gradient-${reviewerId || certId || Math.random()}`;

  return (
    <div className="flex items-center gap-2" ref={menuRef}>
      {/* Icon buttons */}
      <button
        title="View"
        className="text-blue-400 hover:text-blue-600 p-1 cursor-pointer"
        onClick={handleView}
        disabled={isActionLoading}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-eye-icon lucide-eye"
        >
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button
        title="Send Reminder"
        className="text-yellow-400 hover:text-yellow-600 p-1 cursor-pointer"
        onClick={handleSendReminder}
        disabled={isActionLoading}
      >
        <BellIcon />
      </button>
      <button
        title="Escalate"
        className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
        onClick={handleEscalate}
        disabled={isActionLoading}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-arrow-up-narrow-wide-icon lucide-arrow-up-narrow-wide"
        >
          <path d="m3 8 4-4 4 4" />
          <path d="M7 4v16" />
          <path d="M11 12h4" />
          <path d="M11 16h7" />
          <path d="M11 20h10" />
        </svg>
      </button>
      <button
        title="Microsoft Teams"
        aria-label="Open in Microsoft Teams"
        onClick={(e) => {
          e.stopPropagation();
          handleTeamsClick();
        }}
        className="p-1 rounded transition-colors duration-200 hover:bg-gray-100 flex-shrink-0 cursor-pointer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg
          width="24px"
          height="24px"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          <path
            fill="#5059C9"
            d="M10.765 6.875h3.616c.342 0 .619.276.619.617v3.288a2.272 2.272 0 01-2.274 2.27h-.01a2.272 2.272 0 01-2.274-2.27V7.199c0-.179.145-.323.323-.323zM13.21 6.225c.808 0 1.464-.655 1.464-1.462 0-.808-.656-1.463-1.465-1.463s-1.465.655-1.465 1.463c0 .807.656 1.462 1.465 1.462z"
          />
          <path
            fill="#7B83EB"
            d="M8.651 6.225a2.114 2.114 0 002.117-2.112A2.114 2.114 0 008.65 2a2.114 2.114 0 00-2.116 2.112c0 1.167.947 2.113 2.116 2.113zM11.473 6.875h-5.97a.611.611 0 00-.596.625v3.75A3.669 3.669 0 008.488 15a3.669 3.669 0 003.582-3.75V7.5a.611.611 0 00-.597-.625z"
          />
          <path
            fill={`url(#${gradientId})`}
            d="M1.597 4.925h5.969c.33 0 .597.267.597.596v5.958a.596.596 0 01-.597.596h-5.97A.596.596 0 011 11.479V5.521c0-.33.267-.596.597-.596z"
          />
          <path
            fill="#ffffff"
            d="M6.152 7.193H4.959v3.243h-.76V7.193H3.01v-.63h3.141v.63z"
          />
          <defs>
            <linearGradient
              id={gradientId}
              x1="2.244"
              x2="6.906"
              y1="4.46"
              y2="12.548"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#5A62C3" />
              <stop offset="1" stopColor="#7B83EB" />
            </linearGradient>
          </defs>
        </svg>
      </button>
      <button
        ref={menuButtonRef}
        onClick={toggleMenu}
        title="More Actions"
        className={`cursor-pointer rounded-sm hover:opacity-80 ${
          open ? "bg-[#6D6E73]/20" : ""
        }`}
      >
        <MoreVertical
          color="#35353A"
          size="32"
          className="transfrom scale-[0.6]"
        />
      </button>
      <div className="relative flex items-center">
        {open &&
          createPortal(
            <div
              ref={menuRef}
              className="absolute bg-white border border-gray-300 shadow-lg rounded-md z-50"
              style={{
                position: "fixed",
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                minWidth: "160px",
                padding: "8px",
              }}
            >
              <ul className="py-2 text-sm text-gray-700">
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={handleReassign}
                >
                  Reassign
                </li>
                <li 
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={handleClaim}
                >
                  Claim
                </li>
              </ul>
            </div>,
            document.body
          )}
      </div>
            <ProxyActionModal
              isModalOpen={isModalOpen}
              closeModal={() => setIsModalOpen(false)}
              heading="Reassign"
              users={[
                { username: "john", email: "john@example.com", role: "admin" },
                { username: "jane", email: "jane@example.com", role: "user" },
              ]}
              groups={[
                { name: "admins", email: "admins@corp.com", role: "admin" },
                { name: "devs", email: "devs@corp.com", role: "developer" },
              ]}
              userAttributes={[
                { value: "username", label: "Username" },
                { value: "email", label: "Email" },
              ]}
              groupAttributes={[
                { value: "name", label: "Group Name" },
                { value: "role", label: "Role" },
              ]}
              onSelectOwner={async (owner) => {
                try {
                  setIsActionLoading(true);
                  showApiLoader?.(true, "Reassigning certification...");

                  // Determine owner type and ID
                  const ownerType = owner.username ? "User" : "Group";
                  const ownerId = owner.id || (ownerType === "User" ? (owner.username || owner.email || "") : (owner.name || ""));

                  // Construct the payload
                  const payload = {
                    reviewerName: reviewerId || "",
                    reviewerId: reviewerId || "",
                    certificationId: certId || "",
                    taskId: "", // Not available at this level
                    // At certification level, backend expects certificationId in lineItemId
                    lineItemId: certId || "",
                    assignmentEntity: "Cert",
                    newOwnerDetails: {
                      id: ownerId,
                      type: ownerType,
                    },
                    justification: "Reassignment requested",
                  };

                  // Make the API call
                  const response = await fetch(
                    `https://preview.keyforge.ai/certification/api/v1/ACMECOM/reassign/${reviewerId}/${certId}`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(payload),
                    }
                  );

                  if (!response.ok) {
                    throw new Error(`Reassign failed: ${response.statusText}`);
                  }

                  // Success
                  setIsModalOpen(false);
                  setIsActionLoading(false);
                  hideApiLoader?.();
                  setShowCompletionToast(true);
                } catch (error) {
                  console.error("Error reassigning certification:", error);
                  setIsActionLoading(false);
                  hideApiLoader?.();
                  alert(`Failed to reassign: ${error instanceof Error ? error.message : "Unknown error"}`);
                }
              }}
            />

      {/* Reminder Confirmation Modal */}
      {isReminderModalOpen &&
        createPortal(
          <div className="fixed inset-0 flex items-center justify-center bg-gray-900/50 px-3 z-[99]">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Send Reminder</h2>
              <p className="text-gray-600 mb-4">
                Are you sure you want to send a reminder email to the reviewer?
              </p>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyManager}
                    onChange={(e) => setCopyManager(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Copy reviewer's manager in the email
                  </span>
                </label>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsReminderModalOpen(false);
                    setCopyManager(false);
                  }}
                  className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReminder}
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Send Reminder
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Claim Confirmation Modal */}
      {isClaimModalOpen &&
        createPortal(
          <div className="fixed inset-0 flex items-center justify-center bg-gray-900/50 px-3 z-[99]">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Confirm Claim Action</h2>
              <p className="text-gray-600 mb-4">
                Are you sure you want to claim this review and reassign it to admin?
              </p>
              <p className="text-sm text-gray-500 mb-4">
                This action will transfer the review responsibility to the admin user.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsClaimModalOpen(false)}
                  className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmClaim}
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Confirm Claim
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Action Completed Toast */}
      <ActionCompletedToast
        isVisible={showCompletionToast}
        messages={['Reminder sent successfully', 'Email notification sent']}
        onClose={() => setShowCompletionToast(false)}
        messageDuration={1000}
      />
    </div>
  );
};

export default ChampaignActionButton;
