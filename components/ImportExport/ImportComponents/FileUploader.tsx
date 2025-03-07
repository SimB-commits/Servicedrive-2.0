import React from 'react';

interface FileUploaderProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  importFile: File | null;
  fileType: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  fileInputRef, 
  importFile, 
  fileType,
  onFileChange 
}) => {
  return (
    <div>
      <h4 className="font-medium mb-2">2. Välj importfil</h4>
      <div className="flex flex-col gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          accept=".csv,.xlsx,.xls,.json"
          className="block w-full text-sm text-default-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-600"
        />
        <p className="text-xs text-default-500">
          Stödjer .csv, .xlsx, .xls, och .json
        </p>
        
        {importFile && (
          <div className="mt-2 p-2 bg-default-100 rounded-md">
            <p className="text-sm font-medium">{importFile.name}</p>
            <p className="text-xs text-default-500">
              {fileType?.toUpperCase()} | {(importFile.size / 1024).toFixed(0)} KB
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;