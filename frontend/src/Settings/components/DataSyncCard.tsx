// File: src/Settings/components/DataSyncCard.tsx
import React, { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { uploadStatements } from '../../api/apiClient';
import toast from 'react-hot-toast';

const DataSyncCard: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadToast = toast.loading('Uploading files...');

    try {
      const response = await uploadStatements(Array.from(files));
      toast.success(response.message, { id: uploadToast });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "An error occurred during upload.";
      toast.error(errorMessage, { id: uploadToast });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  return (
    <div className="bg-candy-mint border-2 border-dashed border-line rounded-cardLg p-6 flex flex-col sm:flex-row sm:items-center gap-5 text-[#1E1B16]">
      <div className="w-14 h-14 rounded-card bg-card border-2 border-line shadow-card flex items-center justify-center shrink-0">
        <FileText size={24} />
      </div>

      <div className="flex-1">
        <h2 className="font-heading font-extrabold text-[17px]">Import bank statements</h2>
        <p className="font-body text-[12.5px] mt-0.5">
          Upload new statement files and we'll parse the transactions automatically.
        </p>
        <div className="flex flex-wrap gap-2 mt-2.5">
          <span className="bg-card border-1.5 border-line rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold">.csv</span>
          <span className="bg-card border-1.5 border-line rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold">.xlsx</span>
          <span className="bg-card border-1.5 border-line rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold">.pdf</span>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept=".csv,.xlsx,.xls,.pdf" />
      <button
        onClick={handleUploadClick}
        disabled={isUploading}
        className="bg-ink text-bg border-2 border-line rounded-chip shadow-overlay px-5 py-3 font-heading font-extrabold text-[13.5px] flex items-center justify-center gap-2 shrink-0 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all duration-press disabled:opacity-60 disabled:pointer-events-none"
      >
        <Upload size={17} />
        {isUploading ? 'Uploading...' : 'Upload statements'}
      </button>
    </div>
  );
};
export default DataSyncCard;
