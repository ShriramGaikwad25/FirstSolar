import Image from 'next/image';
import { executeQuery } from '@/lib/api';

// Load users from ISPM API using executeQuery
export const loadUsers = async (inputValue: string) => {
  try {
    // Build query with search filter
    let query = "SELECT * FROM usr";
    const parameters: string[] = [];
    
    if (inputValue && inputValue.trim()) {
      const searchTerm = `%${inputValue.trim()}%`;
      query += " WHERE username ILIKE ? OR email::text ILIKE ? OR displayname ILIKE ? OR firstname ILIKE ? OR lastname ILIKE ?";
      parameters.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const response = await executeQuery<any>(query, parameters);
    
    // Handle different response structures
    let usersData: any[] = [];
    if (response?.resultSet && Array.isArray(response.resultSet)) {
      usersData = response.resultSet;
    } else if (Array.isArray(response)) {
      usersData = response;
    } else if (response?.results && Array.isArray(response.results)) {
      usersData = response.results;
    } else if (response?.data && Array.isArray(response.data)) {
      usersData = response.data;
    } else if (response?.items && Array.isArray(response.items)) {
      usersData = response.items;
    }
    
    // Map to MultiSelect format
    return usersData.map((user: any) => {
      // Extract email
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
      
      // Get display name
      const displayName = user.displayname || user.displayName || 
                         `${user.firstname || ""} ${user.lastname || ""}`.trim() || 
                         user.username || 
                         "Unknown User";
      
      // Use username as value, display name as label
      // Use a random user image from available user images for variety
      const userImageIndex = Math.floor(Math.random() * 9) + 2; // Random between 2-11
      return {
        value: user.username || emailValue || String(user.id || ""),
        label: displayName,
        image: `/pictures/user_image${userImageIndex}.svg`,
      };
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
};

// Load groups from ISPM API using executeQuery
export const loadGroups = async (inputValue: string) => {
  try {
    // Build query with search filter
    let query = "SELECT group_id, name FROM kf_groups";
    const parameters: string[] = [];
    
    if (inputValue && inputValue.trim()) {
      const searchTerm = `%${inputValue.trim()}%`;
      query += " WHERE name ILIKE ?";
      parameters.push(searchTerm);
    }
    
    const response = await executeQuery<any>(query, parameters);
    
    // Handle different response structures
    let groupsData: any[] = [];
    if (response?.resultSet && Array.isArray(response.resultSet)) {
      groupsData = response.resultSet;
    } else if (Array.isArray(response)) {
      groupsData = response;
    } else if (response?.results && Array.isArray(response.results)) {
      groupsData = response.results;
    } else if (response?.data && Array.isArray(response.data)) {
      groupsData = response.data;
    } else if (response?.items && Array.isArray(response.items)) {
      groupsData = response.items;
    }
    
    // Map to MultiSelect format
    return groupsData.map((group: any) => {
      const groupName = group.name || "Unknown Group";
      const groupId = group.group_id || group.id || "";
      
      return {
        value: groupId,
        label: groupName,
        image: "/window.svg", // Default icon for groups
      };
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
};

type App = {
  label: string;
  value: string;
  image: string; // Assuming image is a string URL
};
export const loadApps = async (inputValue: string): Promise<App[]> => {
  try {
    const response = await fetch(
      "http://ax.itunes.apple.com/WebObjects/MZStoreServices.woa/ws/RSS/topfreeapplications/limit=100/genre=6007/json"
    );
    if (!response.ok) throw new Error("Failed to fetch apps");
    const data = await response.json();
    return data.feed.entry
      .filter((app: { "im:name": { label: string } }) =>
        app["im:name"].label.toLowerCase().includes(inputValue.toLowerCase())
      )
      .map((app: { "im:name": { label: string }; id: { label: string }; "im:image": { label: string }[] }) => ({
        label: app["im:name"].label, // App Name
        value: app.id.label, // App ID
        image: app["im:image"][2].label, // Medium-sized app icon (image URL)
      }));
  } catch (error) {
    console.error("Error fetching apps:", error);
    return [];
  }
};

// Mapping and helper to mirror Applications page logos
const LOGO_BY_NAME: Record<string, string> = {
  "Active Directory": "/ActiveDirectory.svg",
  "AcmeCorporateDirectory": "/ActiveDirectory.svg",
  "Oracle": "/Oracle.svg",
  "SAP": "/SAP.svg",
  "Workday": "/workday.svg",
};

const LOGO_BY_KEYWORD: Array<{ keyword: string; src: string }> = [
  { keyword: "active directory", src: "/ActiveDirectory.svg" },
  { keyword: "corporate directory", src: "/ActiveDirectory.svg" },
  { keyword: "oracle", src: "/Oracle.svg" },
  { keyword: "sap", src: "/SAP.svg" },
  { keyword: "workday", src: "/workday.svg" },
];

export const getLogoSrc = (appName: string) => {
  if (!appName) return "/window.svg";
  if (LOGO_BY_NAME[appName]) return LOGO_BY_NAME[appName];
  const lower = appName.toLowerCase();
  const kw = LOGO_BY_KEYWORD.find((k) => lower.includes(k.keyword));
  if (kw) return kw.src;
  return "/window.svg";
};

// Load Applications from ISPM API to match Applications component data and logos
export const loadIspmApps = async (inputValue: string): Promise<App[]> => {
  try {
    const { getReviewerId } = await import("@/lib/auth");
    const reviewerId = getReviewerId() || "";
    if (!reviewerId) {
      console.error("Reviewer ID not found");
      return [];
    }
    const response = await fetch(
      `https://preview.keyforge.ai/entities/api/v1/ACMECOM/getApplications/${reviewerId}`
    );
    if (!response.ok) throw new Error("Failed to fetch applications");
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    return items
      .filter((app: any) =>
        (app.applicationinstancename || "")
          .toLowerCase()
          .includes((inputValue || "").toLowerCase())
      )
      .map((app: any) => ({
        label: app.applicationinstancename,
        value: app.applicationInstanceId,
        image: getLogoSrc(app.applicationinstancename),
      }));
  } catch (error) {
    console.error("Error fetching ISPM apps:", error);
    return [];
  }
};
type OptionData = {
  label: string;
  image: string; 
};

export const customOption = (props: { data: OptionData; innerRef: React.Ref<HTMLDivElement>; innerProps: React.HTMLAttributes<HTMLDivElement> }) => {
  const { data, innerRef, innerProps } = props;
  const imageSrc = data.image && data.image.trim() ? data.image : "/window.svg";
  
  return (
    <div ref={innerRef} {...innerProps} className="flex items-center p-2 hover:bg-[#DEEBFF]">
      <Image
        src={imageSrc}
        alt={data.label || "Option"}
        width={32}
        height={32}
        className="rounded-full mr-2"
      />
      {data.label}
    </div>
  );
};
