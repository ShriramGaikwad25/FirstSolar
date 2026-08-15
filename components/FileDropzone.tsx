import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useController, Control } from "react-hook-form";

interface FileDropzoneProps {
  name: string;
  control: Control;
  onChange?: (file: File | null) => void; // Optional external onChange handler
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ name, control, onChange: externalOnChange }) => {
  const {
    field: { onChange, value },
    fieldState: { error },
  } = useController({ name, control });

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles.length > 0 ? acceptedFiles[0] : null;
      onChange(file); // Update react-hook-form state
      if (externalOnChange) {
        externalOnChange(file); // Trigger external onChange handler
      }
    },
    [onChange, externalOnChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      "text/csv": [],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
      "application/vnd.ms-excel": [],
    },
    multiple: false,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-1 border-dashed p-6 rounded-md text-center cursor-pointer transition-all 
          ${isDragActive ? "border-blue-500 bg-blue-100" : "border-blue-300 bg-blue-100/50"}
        `}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-700">Drop the file here...</p>
        ) : (
          <p>Drag & drop a CSV or Excel file here, or click to select one</p>
        )}
      </div>

      {/* Show selected file name */}
      {value instanceof File && (
        <small className="text-green-700 font-semibold">
          Selected: {value.name}
        </small>
      )}

      {/* Show error if validation fails */}
      {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
    </div>
  );
};

export default FileDropzone;
