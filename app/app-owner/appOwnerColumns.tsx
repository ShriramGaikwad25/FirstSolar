import ActionButtons from "@/components/agTable/ActionButtons";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { MoveUp, User } from "lucide-react";
import Image from "next/image";
import React, { JSX } from "react";

type RiskLevel = "Critical" | "High" | "Medium" | "Low";

interface UserData {
  user: string;
  avatar?: string;
  risk: RiskLevel;
  id: string;
  jobTitle: string;
  status:string;
  changeSinceLastReview: string;
  aIAssistConfidence: "thumbs-up" | "thumbs-down";
}

interface UserCellRendererParams extends ICellRendererParams {
  data: UserData;
}

const openModal = () =>{
  alert("Modal opened")
}

export const appOwnerColumns: ColDef[] = [
  {
    field: "Account ID",
    headerName: "Account ID",
    cellRenderer: (params: UserCellRendererParams) => {
      const { data, node } = params;
      const depth = node.level;

      return (
        <div className="flex items-center space-x-2">
          {/* Checkbox */}
          {}

          {/* Avatar or Icons */}
          {}

          {/* Text */}
          <div className="flex flex-col gap-0 cursor-pointer hover:underline" onClick={openModal}>
            <span className="font-semibold text-[#175AE4] text-[12px]">
              User
            </span>
            <span className="text-gray-800 font-bold text-[12px]">
              {data.user}
            </span>
          </div>
        </div>
      );
    },
  },
  // {
  //   field: "risk",
  //   headerName: "Risk",
  //     };

  //       </div>
  //     );
  //   },
  // },
  {
    field: "User ID",
    headerName: "User ID",
    cellRenderer: (params: ICellRendererParams) => (
      <div className="flex flex-col gap-0">
        <span className="font-semibold text-[#175AE4] text-[12px]">ID</span>
        <span className="text-gray-800">{params.value}</span>
      </div>
    ),
  },
  {
    field: "Ent Name",
    headerName: "Entitlement Name",
    cellRenderer: (params: ICellRendererParams) => (
      <div className="flex flex-col gap-0">
        <span className="font-semibold text-[#175AE4] text-[12px]">
          Job Title
        </span>
        <span className="text-gray-800">{params.value}</span>
      </div>
    ),
  },
  {
    field: "Entitlement Description",
    headerName: "Entitlement Description",
    cellRenderer: (params: ICellRendererParams) => (
      <div className="flex flex-col gap-0">
        <span className="font-semibold text-[#175AE4] text-[12px]">
          Change Since Last Review
        </span>
        <span className="text-gray-800">{params.value}</span>
      </div>
    ),
  },
  {
    field: "aIAssistConfidence",
    headerName: "AI Insights",
    cellRenderer: (params: ICellRendererParams) => {
      const icon =
        params.value === "thumbs-up" ? (
          <svg width="21" height="16" viewBox="0 0 21 18" className="m-auto">
            <path
              fill="#34C759"
              d="  M3.76 7.5V18.76H0V7.5H3.76ZM18.76 6.24C18.9277 6.23138 19.0954 6.25807 19.2522 6.31834C19.409 6.37861 19.5513 6.47112 19.6701 6.58989C19.7889 6.70866 19.8814 6.85103 19.9417 7.00781C20.0019 7.16458 20.0286 7.33226 20.02 7.5V12.16C19.9961 12.3819 19.9353 12.5982 19.84 12.8L17 17.54C16.772 17.9044 16.4571 18.2066 16.0837 18.4195C15.7102 18.6324 15.2898 18.7494 14.86 18.76H7.5C6.83696 18.76 6.20107 18.4966 5.73223 18.0278C5.26339 17.5589 5 16.923 5 16.26V7.12C5.00576 6.55515 5.19531 6.00753 5.54 5.56L10 0C10.3342 0 10.6547 0.13275 10.891 0.369045C11.1273 0.605341 11.26 0.925827 11.26 1.26V6.26L18.76 6.24Z"
            />
          </svg>
        ) : (
          <svg
            width="21"
            height="16"
            viewBox="0 0 21 18"
            fill="none"
            className="m-auto"
          >
            <path
              fill="#FF2D55"
              d="M3.76 11.24V0H0V11.26L3.76 11.24ZM18.76 12.5C18.9277 12.5086 19.0954 12.4819 19.2522 12.4217C19.409 12.3614 19.5513 12.2689 19.6701 12.1501C19.7889 12.0313 19.8814 11.889 19.9417 11.7322C20.0019 11.5754 20.0286 11.4077 20.02 11.24V6.58C19.9961 6.35812 19.9353 6.1418 19.84 5.94L17 1.2C16.7678 0.836499 16.4487 0.53649 16.0717 0.327006C15.6946 0.117522 15.2713 0.00514447 14.84 0H7.5C6.83696 0 6.20107 0.263392 5.73223 0.732233C5.26339 1.20107 5 1.83696 5 2.5V11.62C5 12.1933 5.18 12.7133 5.54 13.18L10 18.74C10.3342 18.74 10.6547 18.6073 10.891 18.371C11.1273 18.1347 11.26 17.8142 11.26 17.48V12.48L18.76 12.5Z"
            />
          </svg>
        );

      return (
        <div className="flex flex-col gap-0">
          {}
          <span className="text-gray-800">{icon}</span>
        </div>
      );
    },
  },
  {
    field: "actions",
    headerName: "Actions",
    cellRenderer: (params: ICellRendererParams) => {
      return <ActionButtons api={params.api} selectedRows={[params.data]} />;
    },
  },
];
