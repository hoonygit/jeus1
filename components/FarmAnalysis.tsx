
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { BrixData } from '../types';

interface FarmAnalysisProps {
  data: BrixData[];
  farmerList: string[];
}

// Helper to parse date string to local Date object
const parseDateAsLocal = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            return new Date(year, month, day);
        }
    }
    return null;
};

const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const FarmAnalysis: React.FC<FarmAnalysisProps> = ({ data, farmerList }) => {
  const [selectedFarm, setSelectedFarm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<number | null>(null);

  // Set initial selected farm and date range
  useEffect(() => {
    if (farmerList.length > 0 && !selectedFarm) {
      setSelectedFarm(farmerList[0]);
    }
  }, [farmerList, selectedFarm]);

  useEffect(() => {
    if (data.length > 0 && !startDate && !endDate) {
        const sorted = [...data].sort((a,b) => a.MEASURE_DATE.getTime() - b.MEASURE_DATE.getTime());
        setStartDate(formatDateToYYYYMMDD(sorted[0].MEASURE_DATE));
        setEndDate(formatDateToYYYYMMDD(sorted[sorted.length - 1].MEASURE_DATE));
    }
  }, [data, startDate, endDate]);


  // 1. Filter data for the selected farm
  const farmData = useMemo(() => {
    return data.filter(d => d.FARMLAND === selectedFarm);
  }, [data, selectedFarm]);

  // 2. Calculate Yearly Averages (All time)
  const yearlyAverages = useMemo(() => {
    const yearMap = new Map<string, { sum: number, count: number }>();
    farmData.forEach(d => {
        const year = d.MEASURE_DATE.getFullYear().toString();
        if (!yearMap.has(year)) {
            yearMap.set(year, { sum: 0, count: 0 });
        }
        const entry = yearMap.get(year)!;
        entry.sum += d.BRIX;
        entry.count += 1;
    });

    return Array.from(yearMap.entries())
        .map(([year, stats]) => ({
            year,
            avg: parseFloat((stats.sum / stats.count).toFixed(2))
        }))
        .sort((a, b) => b.year.localeCompare(a.year));
  }, [farmData]);

  // 3. Filter data by Date Range
  const filteredData = useMemo(() => {
    const start = parseDateAsLocal(startDate);
    const end = parseDateAsLocal(endDate);
    if (!start || !end) return farmData;
    // End date inclusive
    end.setHours(23, 59, 59, 999);
    
    return farmData.filter(d => d.MEASURE_DATE >= start && d.MEASURE_DATE <= end);
  }, [farmData, startDate, endDate]);

  // 4. Calculate Chart Data
  // Shows bars only for dates with data, but the value is Cumulative Average Year-To-Date
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { total: number, count: number, date: Date }>();
    const sortedFarmData = [...farmData].sort((a,b) => a.MEASURE_DATE.getTime() - b.MEASURE_DATE.getTime());

    // Aggregate daily totals
    for (const item of sortedFarmData) {
        const dateStr = formatDateToYYYYMMDD(item.MEASURE_DATE);
        if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, { total: 0, count: 0, date: item.MEASURE_DATE });
        }
        const d = dailyMap.get(dateStr)!;
        d.total += item.BRIX;
        d.count += 1;
    }

    const sortedDates = Array.from(dailyMap.keys()).sort();
    let currentYear = '';
    let cumulativeSum = 0;
    let cumulativeCount = 0;
    
    const finalMap = new Map<string, number>();
    
    for (const dateStr of sortedDates) {
        const dayData = dailyMap.get(dateStr)!;
        const year = dayData.date.getFullYear().toString();
        
        if (year !== currentYear) {
            currentYear = year;
            cumulativeSum = 0;
            cumulativeCount = 0;
        }
        
        cumulativeSum += dayData.total;
        cumulativeCount += dayData.count;
        
        finalMap.set(dateStr, parseFloat((cumulativeSum / cumulativeCount).toFixed(2)));
    }

    const start = parseDateAsLocal(startDate);
    const end = parseDateAsLocal(endDate);
    if (!start || !end) return [];
    end.setHours(23, 59, 59, 999);

    // Filter to show only dates that exist within the selected range
    // This ensures bars are only drawn where data exists
    return sortedDates
        .filter(dateStr => {
            const d = parseDateAsLocal(dateStr);
            return d && d >= start && d <= end;
        })
        .map(dateStr => ({
            date: dateStr,
            brix: finalMap.get(dateStr)
        }));

  }, [farmData, startDate, endDate]);

  // 5. Calculate Tag Heatmap Data
  const tagData = useMemo(() => {
    const tagMap = new Map<number, { sum: number, count: number }>();
    
    filteredData.forEach(d => {
        if (d.TAG_NO !== 0) {
            if (!tagMap.has(d.TAG_NO)) {
                tagMap.set(d.TAG_NO, { sum: 0, count: 0 });
            }
            const t = tagMap.get(d.TAG_NO)!;
            t.sum += d.BRIX;
            t.count += 1;
        }
    });

    return Array.from(tagMap.entries())
        .map(([tag, stats]) => ({
            tag,
            avg: parseFloat((stats.sum / stats.count).toFixed(2))
        }))
        .sort((a, b) => a.tag - b.tag);
  }, [filteredData]);

  // 6. Calculate Data for Selected Tag Modal
  const selectedTagDetails = useMemo(() => {
      if (selectedTag === null) return [];
      
      const tagSpecificData = filteredData.filter(d => d.TAG_NO === selectedTag);
      const dailyMap = new Map<string, { sum: number, count: number }>();

      tagSpecificData.forEach(d => {
          const dateStr = formatDateToYYYYMMDD(d.MEASURE_DATE);
          if (!dailyMap.has(dateStr)) {
              dailyMap.set(dateStr, { sum: 0, count: 0 });
          }
          const entry = dailyMap.get(dateStr)!;
          entry.sum += d.BRIX;
          entry.count += 1;
      });

      return Array.from(dailyMap.entries())
          .map(([date, stats]) => ({
              date,
              avg: parseFloat((stats.sum / stats.count).toFixed(2)),
              count: stats.count
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedTag, filteredData]);


  // Heatmap Color helper
  const getHeatmapColor = (brix: number) => {
      if (brix < 9) return '#dbeafe';
      if (brix < 10) return '#93c5fd';
      if (brix < 11) return '#fdba74';
      if (brix < 12) return '#f97316';
      if (brix < 13) return '#ea580c';
      return '#9a3412';
  };

  const getTextColor = (bgColor: string) => {
      if (['#dbeafe', '#93c5fd', '#fdba74'].includes(bgColor)) {
          return '#1e293b';
      }
      return '#ffffff';
  };

  if (!selectedFarm) {
      return <div className="text-center text-text-secondary p-8">데이터가 없습니다.</div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-end border-b pb-4">
        <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-text-secondary mb-1">분석할 농가 선택</label>
            <select 
                value={selectedFarm} 
                onChange={(e) => setSelectedFarm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            >
                {farmerList.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
        </div>
        <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-text-secondary mb-1">시작일</label>
            <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
            />
        </div>
        <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-text-secondary mb-1">종료일</label>
            <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
            />
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 flex-grow overflow-y-auto pr-2">
          
          {/* 1. Yearly Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {yearlyAverages.map(stat => (
                  <div key={stat.year} className="bg-orange-50 rounded-lg p-4 border border-orange-100 text-center shadow-sm">
                      <div className="text-xs text-text-secondary uppercase tracking-wide font-semibold">{stat.year}년 평균</div>
                      <div className="text-2xl font-bold text-primary mt-1">{stat.avg}</div>
                      <div className="text-xs text-gray-400 mt-1">Brix</div>
                  </div>
              ))}
          </div>

          {/* 2. Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm min-h-[300px]">
              <h3 className="text-lg font-semibold mb-4 text-text">기간별 누적 평균 당도 (Year-To-Date)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis domain={[0, 'dataMax + 2']} hide={false} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`${value} Brix`, '누적 평균']}
                    />
                    <Bar dataKey="brix" fill="#F97316" radius={[4, 4, 0, 0]} name="누적 평균" />
                </BarChart>
              </ResponsiveContainer>
          </div>

          {/* 3. Tag Heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-text">TAG 별 평균 당도 히트맵</h3>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>Low (Blue)</span>
                      <div className="flex space-x-0.5">
                          <div className="w-3 h-3 bg-[#dbeafe]"></div>
                          <div className="w-3 h-3 bg-[#93c5fd]"></div>
                          <div className="w-3 h-3 bg-[#fdba74]"></div>
                          <div className="w-3 h-3 bg-[#f97316]"></div>
                          <div className="w-3 h-3 bg-[#ea580c]"></div>
                          <div className="w-3 h-3 bg-[#9a3412]"></div>
                      </div>
                      <span>High (Orange)</span>
                  </div>
              </div>
              <p className="text-xs text-text-secondary mb-4">TAG 번호를 클릭하면 상세 데이터를 확인할 수 있습니다.</p>
              
              {tagData.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">해당 기간에 표시할 태그 데이터가 없습니다.</div>
              ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                      {tagData.map(tag => {
                          const bgColor = getHeatmapColor(tag.avg);
                          const textColor = getTextColor(bgColor);
                          return (
                            <div 
                                key={tag.tag} 
                                onClick={() => setSelectedTag(tag.tag)}
                                className="aspect-square rounded-md flex flex-col items-center justify-center shadow-sm transition-transform hover:scale-105 cursor-pointer hover:shadow-md"
                                style={{ backgroundColor: bgColor, color: textColor }}
                                title={`TAG: ${tag.tag}, Avg: ${tag.avg} Brix`}
                            >
                                <span className="text-[10px] opacity-80">TAG</span>
                                <span className="font-bold text-sm">{tag.tag}</span>
                                <span className="text-[10px] mt-1 bg-black/10 px-1 rounded">{tag.avg}</span>
                            </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>

      {/* Modal for Tag Details */}
      {selectedTag !== null && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTag(null)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg font-bold text-text">TAG {selectedTag} 상세 데이터</h3>
                      <button 
                          onClick={() => setSelectedTag(null)}
                          className="text-gray-500 hover:text-gray-700 p-1"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                      </button>
                  </div>
                  <div className="overflow-y-auto p-0">
                      {selectedTagDetails.length === 0 ? (
                          <p className="p-4 text-center text-gray-500">데이터가 없습니다.</p>
                      ) : (
                          <table className="w-full text-sm text-left">
                              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                                  <tr>
                                      <th className="px-6 py-3">측정 일자</th>
                                      <th className="px-6 py-3 text-center">평균 당도 (Brix)</th>
                                      <th className="px-6 py-3 text-center">측정 횟수</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {selectedTagDetails.map((row, idx) => (
                                      <tr key={row.date} className="bg-white border-b hover:bg-gray-50">
                                          <td className="px-6 py-4 font-medium text-gray-900">{row.date}</td>
                                          <td className="px-6 py-4 text-center text-primary font-bold">{row.avg}</td>
                                          <td className="px-6 py-4 text-center text-gray-500">{row.count}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>
                  <div className="p-4 border-t bg-gray-50 text-right">
                      <button 
                          onClick={() => setSelectedTag(null)}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                          닫기
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default FarmAnalysis;
