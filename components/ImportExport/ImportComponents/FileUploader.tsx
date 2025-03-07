import React, { useCallback, useState } from 'react';
import { 
  Card, 
  CardBody,
  Button,
  Chip
} from '@heroui/react';

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
  const [isDragging, setIsDragging] = useState(false);
  
  // Hantera drag-and-drop funktionalitet
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Kontrollera filens typ
      const file = e.dataTransfer.files[0];
      const fileType = file.name.split('.').pop()?.toLowerCase();
      
      if (fileType && ['csv', 'xlsx', 'xls', 'json'].includes(fileType)) {
        // Skapa en syntetisk event för att återanvända onFileChange
        const syntheticEvent = {
          target: {
            files: e.dataTransfer.files
          }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        
        onFileChange(syntheticEvent);
      } else {
        alert('Filformatet stöds inte. Använd CSV, Excel eller JSON-fil.');
      }
    }
  }, [onFileChange]);
  
  // Trigger fileInput click
  const handleBrowseClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [fileInputRef]);
  
  // Hantera filinformation och visning
  const getFileSize = useCallback((size: number) => {
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
  }, []);
  
  const getFileTypeColor = useCallback((type: string | null) => {
    switch (type) {
      case 'csv': return 'success';
      case 'excel': return 'primary';
      case 'json': return 'warning';
      default: return 'default';
    }
  }, []);

  return (
    <div>
      <h4 className="font-medium mb-2">2. Välj importfil</h4>
      
      {/* Dölj den faktiska file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept=".csv,.xlsx,.xls,.json"
        style={{ display: 'none' }}
      />
      
      {/* Visa en anpassad drop zone */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${
          isDragging 
            ? 'border-primary bg-primary/10' 
            : importFile 
              ? 'border-success bg-success/5' 
              : 'border-default-200 hover:border-primary/50'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {importFile ? (
          <div className="flex flex-col items-center">
            <div className="text-success mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="font-medium">{importFile.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Chip 
                color={getFileTypeColor(fileType)} 
                variant="flat" 
                size="sm"
              >
                {fileType?.toUpperCase()}
              </Chip>
              <Chip variant="flat" size="sm">
                {getFileSize(importFile.size)}
              </Chip>
            </div>
            <Button 
              color="primary" 
              variant="flat" 
              size="sm" 
              className="mt-4" 
              onPress={handleBrowseClick}
            >
              Välj en annan fil
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-primary/60 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="mb-2">
              {isDragging 
                ? <span className="font-medium text-primary">Släpp filen här</span> 
                : 'Dra och släpp en fil här'
              }
            </p>
            <div className="text-sm text-default-500 mb-4">eller</div>
            <Button 
              color="primary" 
              onPress={handleBrowseClick}
            >
              Bläddra efter fil
            </Button>
            <p className="mt-4 text-xs text-default-500">
              Stödjer .csv, .xlsx, .xls, och .json
            </p>
          </div>
        )}
      </div>
      
      {/* Tips och riktlinjer */}
      {!importFile && (
        <Card className="mt-4 bg-default-50">
          <CardBody className="text-sm p-3">
            <h5 className="font-medium text-sm mb-1">Tips</h5>
            <ul className="list-disc list-inside text-xs space-y-1 text-default-500">
              <li>CSV-filer bör ha kolumnrubriker på första raden</li>
              <li>Excel-filer kan innehålla flera arbetsblad, första bladet används för import</li>
              <li>JSON-filer bör innehålla en array av objekt</li>
              <li>Kontrollera att din data är korrekt formaterad innan import</li>
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default FileUploader;