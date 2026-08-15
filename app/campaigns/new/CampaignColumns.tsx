import ActionButtons from "@/components/agTable/ActionButtons";
import { ICellRendererParams, ColDef } from 'ag-grid-community';

import { Calendar, ClipboardList, ListOrdered, RectangleEllipsis, User } from "lucide-react";


type Campaign = {
  id: string;
  status: string;
  campaignName: string;
  description: string;
  instances: number;
  progress: string;
  expiryDate: string;
  owner: string;
  actions?: string;
};

export const CampaignColumns: ColDef<Campaign>[] = [
  {
    field: 'campaignName',
    headerName: 'Campaign Name',
    width: 250,
    cellRenderer: (params: ICellRendererParams<Campaign>) => {
      const cellText = params.value;
      return (
        <div className="flex items-center space-x-2">
          <ClipboardList size={18} strokeWidth={1.5} />
          <div className="flex flex-col gap-0">
            <span className="font-semibold text-[#175AE4] text-[12px]">Campaign Name</span>
            <span className="text-gray-800 font-bold text-[12px]">{cellText}</span>
          </div>
        </div>
      );
    },
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 300,
    cellRenderer: (params: ICellRendererParams<Campaign>) => (
      <div className="flex flex-col gap-0">
        <span className="font-semibold text-[#175AE4] text-[12px]">Description</span>
        <span className="text-gray-800 text-[12px]">{params.value}</span>
      </div>
    ),
  },
  {
    field: 'instances',
    headerName: '# of Instances',
    width: 150,
    cellRenderer: (params: ICellRendererParams<Campaign>) => (
      <div className="flex items-center gap-2">
        <ListOrdered size={18} strokeWidth={1.5} />
        <div className="flex flex-col gap-0">
          <span className="font-semibold text-[#175AE4] text-[12px] whitespace-nowrap"># of Instances</span>
          <span className="text-gray-800 font-bold">{params.value}</span>
        </div>
      </div>
    ),
  },
  {
    field: 'progress',
    headerName: 'Progress',
    width: 150,
    cellRenderer: (params: ICellRendererParams<Campaign>) => (
      <div className="flex items-center gap-2">
        <RectangleEllipsis size={18} strokeWidth={1.5} />
        <div className="flex flex-col gap-0">
          <span className="font-semibold text-[#175AE4] text-[12px]">Progress</span>
          <span className="text-gray-800 text-[12px]">{params.value}</span>
        </div>
      </div>
    ),
  },
  {
    field: 'expiryDate',
    headerName: 'Expiry Date',
    width: 180,
    cellRenderer: (params: ICellRendererParams<Campaign>) => (
      <div className="flex items-center gap-2">
        <Calendar size={18} strokeWidth={1.5} />
        <div className="flex flex-col gap-0">
          <span className="font-semibold text-[#175AE4] text-[12px]">Expiry Date</span>
          <span className="text-gray-800 text-[12px]">{params.value}</span>
        </div>
      </div>
    ),
  },
  {
    field: 'owner',
    headerName: 'Owner',
    width: 200,
    cellRenderer: (params: ICellRendererParams<Campaign>) => (
      <div className="flex items-center gap-2">
        <User size={18} strokeWidth={1.5} />
        <div className="flex flex-col gap-0">
          <span className="font-semibold text-[#175AE4] text-[12px]">Owner</span>
          <span className="text-gray-800 font-bold text-[12px]">{params.value}</span>
        </div>
      </div>
    ),
  },
  {
    field: 'actions',
    headerName: 'Actions',
    width: 200,
    cellRenderer: (params: ICellRendererParams<Campaign>) => {
      const selectedRows = params.api.getSelectedNodes().map(n => n.data);
 
      return (
        <ActionButtons
          selectedRows={selectedRows} api={params.api}         
       
        />
      );
    },
  },
];
