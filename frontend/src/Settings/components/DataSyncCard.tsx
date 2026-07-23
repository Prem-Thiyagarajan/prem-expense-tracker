// File: src/Settings/components/DataSyncCard.tsx
import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
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
    <div className="bg-white rounded-xl shadow-md p-4 flex flex-col space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Data Synchronization</h2>
        <p className="text-sm text-gray-500">Import new transactions from your bank statements</p>
      </div>
      <div className="bg-gray-50 rounded-md px-4 py-3 text-sm">
          <p>Click the button below to upload new statement files (CSV, Excel, or PDF).</p>
      </div>
      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept=".csv,.xlsx,.xls,.pdf" />
      <button onClick={handleUploadClick} disabled={isUploading} className="w-full bg-black hover:bg-gray-800 text-white font-bold py-2 rounded-md flex items-center justify-center gap-2 transition-colors disabled:bg-gray-500">
        <Upload size={18} />
        {isUploading ? 'Uploading...' : 'Upload Bank Statements'}
      </button>
    </div>
  );
};
export default DataSyncCard;