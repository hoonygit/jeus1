
import React, { useRef } from 'react';
import UploadIcon from './icons/UploadIcon';

interface FileUploadProps {
  onFileParsed: (data: any[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileParsed, setLoading, setError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    (window as any).Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (results.errors.length > 0) {
          setError('CSV 파일을 파싱하는 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
          console.error("CSV Parsing Errors:", results.errors);
        } else {
           const requiredColumns = ['FARMLAND', 'MSSR_SN', 'VARIETY', 'TAG_NO', 'BRIX', 'MEASURE_DATE'];
           const hasAllColumns = requiredColumns.every(col => results.meta.fields.includes(col));
           if (!hasAllColumns) {
               setError(`CSV 파일에 필수 컬럼이 없습니다. (${requiredColumns.join(', ')})`);
           } else {
               onFileParsed(results.data);
           }
        }
        setLoading(false);
      },
      error: (error: any) => {
        setError('파일을 읽는 중 오류가 발생했습니다.');
        console.error("File Read Error:", error);
        setLoading(false);
      },
    });
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileChange}
      />
      <button
        onClick={handleButtonClick}
        className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors duration-200"
      >
        <UploadIcon className="w-5 h-5 mr-2" />
        CSV 데이터 업로드
      </button>
    </div>
  );
};

export default FileUpload;
