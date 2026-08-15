import Dialog from "@/components/Dialog";
import { asterisk } from "@/utils/utils";
import { useEffect, useState } from "react";
interface SubmitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  saveAsTemplate: boolean;
  setSaveAsTemplate: React.Dispatch<React.SetStateAction<boolean>>;
  certificationTemplate: string;
  setCertificationTemplate: (value: string) => void; 
}

const SubmitDialog: React.FC<SubmitDialogProps> = ({  
  isOpen,
  onClose,
  onConfirm,
  saveAsTemplate,
  setSaveAsTemplate,
  certificationTemplate,
  setCertificationTemplate, }) => {
  
    const [templateName, setTemplateName] = useState(certificationTemplate); 
    useEffect(() => {
      if (isOpen) {
        setTemplateName(certificationTemplate);
      }
    }, [isOpen, certificationTemplate]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${saveAsTemplate ? 'Save New Template' : 'Data submitted successfully'}`}
      ctaText={`${saveAsTemplate ? 'Save Template' : 'Create Campaign'}`}
      onConfirm={() => {
        if (onConfirm) {
          onConfirm();
        }
        onClose();
        setSaveAsTemplate(false);
      }}
    >
      {!saveAsTemplate && <>
        <p>
          Preparing <strong>New Campaign</strong> in progress...
        </p>
        <p className="py-4 text-sm">
          Save time and streamline your workflow! You can save this campaign creation flow as a template. This allows you to reuse the same setup for future campaigns without starting from scratch. Simply select a saved template, make necessary adjustments, and launch your campaign faster!
        </p>
        <p className="cursor-pointer" onClick={() => {
          setSaveAsTemplate(true);
        }}>
          <strong>Save as Template</strong>.
        </p>
      </>}
      {saveAsTemplate && <div className="my-6">
        <label className={` ${asterisk}`}>Certification Template</label>
        <input
          type="text"
          className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
          value={templateName}
          onChange={(e) => {
            setTemplateName(e.target.value);
            setCertificationTemplate(e.target.value); // Update formData
          }} />
      </div>}
    </Dialog>
  );
};

export default SubmitDialog;
