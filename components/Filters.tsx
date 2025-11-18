
import React from 'react';
import type { FilterState } from '../types';

interface FiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  farmerList: string[];
  varietyList: string[];
}

const Filters: React.FC<FiltersProps> = ({ filters, onFilterChange, farmerList, varietyList }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        onFilterChange({
          ...filters,
          [name]: checked,
        });
    } else {
        onFilterChange({
          ...filters,
          [name]: value,
        });
    }
  };

  const handleFarmlandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const currentFarmlands = filters.farmlands;

    let newFarmlands: string[];
    if (checked) {
      if (currentFarmlands.length < 5) {
        newFarmlands = [...currentFarmlands, value];
      } else {
        return; 
      }
    } else {
      newFarmlands = currentFarmlands.filter(farm => farm !== value);
    }
    
    onFilterChange({ ...filters, farmlands: newFarmlands });
  };
  
  const isFarmlandSelectionDisabled = filters.farmlands.length >= 5;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">농가명 (최대 5개)</label>
            <div className="max-h-40 overflow-y-auto space-y-2 p-2 border border-gray-300 rounded-md">
                {farmerList.map(farmer => {
                    const isChecked = filters.farmlands.includes(farmer);
                    return (
                        <div key={farmer} className="flex items-center">
                            <input
                                type="checkbox"
                                id={`farm-${farmer}`}
                                value={farmer}
                                checked={isChecked}
                                onChange={handleFarmlandChange}
                                disabled={!isChecked && isFarmlandSelectionDisabled}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50"
                            />
                            <label htmlFor={`farm-${farmer}`} className={`ml-2 block text-sm text-text ${!isChecked && isFarmlandSelectionDisabled ? 'text-gray-400' : ''}`}>{farmer}</label>
                        </div>
                    );
                })}
            </div>
             {isFarmlandSelectionDisabled && (
                <p className="text-xs text-amber-600 mt-1">최대 5개 농가까지 선택할 수 있습니다.</p>
            )}
        </div>
        <div>
            <label htmlFor="variety" className="block text-sm font-medium text-text-secondary mb-1">과수 종류</label>
            <select
                id="variety"
                name="variety"
                value={filters.variety}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            >
                <option value="ALL">전체 과수</option>
                {varietyList.map(variety => (
                    <option key={variety} value={variety}>{variety}</option>
                ))}
            </select>
        </div>
        <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center mb-2">
                 <input
                    type="checkbox"
                    id="dateFilterEnabled"
                    name="dateFilterEnabled"
                    checked={filters.dateFilterEnabled}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="dateFilterEnabled" className="ml-2 block text-sm font-medium text-text-secondary">기간 필터</label>
            </div>
            <div className="space-y-4">
                <div>
                    <label htmlFor="startDate" className={`block text-sm font-medium mb-1 ${!filters.dateFilterEnabled ? 'text-gray-400' : 'text-text-secondary'}`}>시작일</label>
                    <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleInputChange}
                        disabled={!filters.dateFilterEnabled}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                </div>
                <div>
                    <label htmlFor="endDate" className={`block text-sm font-medium mb-1 ${!filters.dateFilterEnabled ? 'text-gray-400' : 'text-text-secondary'}`}>종료일</label>
                    <input
                        type="date"
                        id="endDate"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleInputChange}
                        disabled={!filters.dateFilterEnabled}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                </div>
            </div>
        </div>
    </div>
  );
};

export default Filters;