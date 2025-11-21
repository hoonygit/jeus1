
import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { BrixData } from '../types';

interface YearlyTrendAnalysisProps {
  data: BrixData[];
}

// Define a vibrant color palette for different years
const YEAR_COLORS = [
  '#DC2626', // Red 600
  '#2563EB', // Blue 600
  '#16A34A', // Green 600
  '#D97706', // Amber 600
  '#7C3AED', // Violet 600
  '#DB2777', // Pink 600
  '#0891B2', // Cyan 600
  '#4B5563', // Gray 600
];

const YearlyTrendAnalysis: React.FC<YearlyTrendAnalysisProps> = ({ data }) => {
  const [selectedVariety, setSelectedVariety] = useState<string>('');
  const [activeYear, setActiveYear] = useState<string | null>(null);

  // 1. Extract unique varieties
  const varietyList = useMemo(() => {
    const varieties = new Set(data.map(d => d.VARIETY));
    return Array.from(varieties).sort();
  }, [data]);

  // 2. Set default variety (Prefer '온주밀감', otherwise first available)
  useEffect(() => {
    if (varietyList.length > 0 && !selectedVariety) {
      if (varietyList.includes('온주밀감')) {
        setSelectedVariety('온주밀감');
      } else {
        setSelectedVariety(varietyList[0]);
      }
    }
  }, [varietyList, selectedVariety]);

  // 3. Process Data for the Chart and Summary
  const { chartData, years, yearlyAverages } = useMemo(() => {
    if (!selectedVariety) return { chartData: [], years: [], yearlyAverages: [] };

    // Filter by Variety
    const filteredData = data.filter(d => d.VARIETY === selectedVariety);
    
    if (filteredData.length === 0) return { chartData: [], years: [], yearlyAverages: [] };

    // Group by Year
    const yearMap = new Map<string, BrixData[]>();
    filteredData.forEach(d => {
        const year = d.MEASURE_DATE.getFullYear().toString();
        if (!yearMap.has(year)) yearMap.set(year, []);
        yearMap.get(year)!.push(d);
    });

    const yearsFound = Array.from(yearMap.keys()).sort();

    // Calculate Overall Yearly Averages for Summary Cards
    const yearlyAvgs = yearsFound.map(year => {
        const records = yearMap.get(year)!;
        const sum = records.reduce((acc, curr) => acc + curr.BRIX, 0);
        const avg = parseFloat((sum / records.length).toFixed(2));
        return { year, avg };
    });

    // Normalize Data to MM-DD Timeline
    const normalizedDataMap = new Map<string, any>(); 

    yearsFound.forEach(year => {
        const yearData = yearMap.get(year)!;
        
        // Aggregate daily first
        const dailyAgg = new Map<string, {sum: number, count: number, origDate: Date}>();
        
        yearData.forEach(d => {
            const dateKey = `${d.MEASURE_DATE.getMonth()}-${d.MEASURE_DATE.getDate()}`;
            if(!dailyAgg.has(dateKey)) {
                dailyAgg.set(dateKey, { sum: 0, count: 0, origDate: d.MEASURE_DATE });
            }
            const entry = dailyAgg.get(dateKey)!;
            entry.sum += d.BRIX;
            entry.count += 1;
        });

        // Calculate daily average (Not cumulative, as requested)
        dailyAgg.forEach(({ sum, count, origDate }, key) => {
            const avg = parseFloat((sum / count).toFixed(2));

            // Create normalized Date Key (MM-DD)
            const month = (origDate.getMonth() + 1).toString().padStart(2, '0');
            const day = origDate.getDate().toString().padStart(2, '0');
            const normalizedKey = `${month}-${day}`;
            
            // Use a leap year (2024) for sorting to handle Feb 29
            const sortValue = new Date(2024, origDate.getMonth(), origDate.getDate()).getTime();

            if (!normalizedDataMap.has(normalizedKey)) {
                normalizedDataMap.set(normalizedKey, {
                    name: normalizedKey,
                    sortValue: sortValue,
                });
            }
            
            // Assign value to the specific year key
            const dataPoint = normalizedDataMap.get(normalizedKey);
            dataPoint[year] = avg;
        });
    });

    // Convert Map to Array and Sort by Date
    const finalChartData = Array.from(normalizedDataMap.values()).sort((a, b) => a.sortValue - b.sortValue);

    return { chartData: finalChartData, years: yearsFound, yearlyAverages: yearlyAvgs };

  }, [data, selectedVariety]);

  // Handle Legend/Card Click: Toggle active year
  const handleToggleYear = (year: string) => {
    setActiveYear(prev => prev === year ? null : year);
  };

  const handleLegendClick = (e: any) => {
    // In Recharts, 'e' is the payload object which contains 'dataKey'.
    const { dataKey } = e;
    handleToggleYear(dataKey);
  };

  // Handle Chart Background Click: Reset selection
  const handleChartClick = (e: any) => {
    if (activeYear !== null) {
        // Check if we clicked directly on a line or active element is tricky in pure Recharts click event
        // But assuming chart background click implies "deselect all"
        // If 'e' is undefined or has no activePayload, it's likely a background click
        // But simpler UX: clicking background resets.
        if (e && e.activePayload) {
             // Clicked on chart content, maybe let it select? 
             // For now, let's keep it simple: Click empty space -> reset.
             // Recharts passes arguments differently based on where you click.
             // If we want pure reset, we can put a wrapper div onClick. But this is fine.
        } else {
             setActiveYear(null);
        }
    }
  };

  // Optimization: Sort years for rendering so the active year is drawn LAST (on top)
  const renderYears = useMemo(() => {
    if (!activeYear) return years;
    // Move activeYear to the end of the array
    return [...years].sort((a, b) => (a === activeYear ? 1 : -1));
  }, [years, activeYear]);


  // Unique key to force re-render when data or selection changes
  // Including activeYear in key forces a clean re-render for style updates
  const chartKey = `trend-chart-${selectedVariety}-${chartData.length}-${years.join('-')}-${activeYear || 'none'}`;

  return (
    <div className="h-full flex flex-col space-y-4 p-1">
      {/* Header / Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm flex-shrink-0">
        <div className="mb-4 sm:mb-0">
            <h2 className="text-xl font-bold text-gray-800">연도별 평균 당도 추세</h2>
            <p className="text-sm text-text-secondary mt-1">
                선택한 품종({selectedVariety})의 연도별 당도 변화를 날짜 기준으로 비교합니다.
            </p>
        </div>
        <div className="flex items-center bg-white p-2 rounded-md border border-gray-200">
            <label htmlFor="variety-select" className="mr-3 font-medium text-gray-700 whitespace-nowrap">품종 선택:</label>
            <select
                id="variety-select"
                value={selectedVariety}
                onChange={(e) => {
                    setSelectedVariety(e.target.value);
                    setActiveYear(null); // Reset highlight on variety change
                }}
                className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary min-w-[180px] text-gray-800 font-medium"
            >
                {varietyList.map(v => (
                    <option key={v} value={v}>{v}</option>
                ))}
            </select>
        </div>
      </div>

      {/* Yearly Averages Summary Cards */}
      {yearlyAverages.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 flex-shrink-0">
            {yearlyAverages.map((stat, index) => {
                const colorIndex = years.indexOf(stat.year);
                const color = YEAR_COLORS[colorIndex % YEAR_COLORS.length];
                const isActive = activeYear === stat.year;
                const isDimmed = activeYear !== null && !isActive;

                return (
                    <div 
                        key={stat.year} 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggleYear(stat.year);
                        }}
                        className={`
                            relative rounded-lg p-3 border text-center cursor-pointer transition-all duration-200
                            ${isActive ? 'ring-2 ring-offset-1 shadow-md transform -translate-y-0.5' : 'hover:bg-gray-50 hover:shadow-sm'}
                            ${isDimmed ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}
                        `}
                        style={{ 
                            borderColor: isActive ? color : '#E5E7EB',
                            backgroundColor: isActive ? 'white' : 'white' 
                        }}
                    >
                        <div 
                            className="text-xs uppercase tracking-wide font-bold mb-1" 
                            style={{ color: color }}
                        >
                            {stat.year}년
                        </div>
                        <div className="text-xl font-bold text-gray-800 leading-none">
                            {stat.avg}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">평균 Brix</div>
                        
                        {/* Active Indicator Dot */}
                        {isActive && (
                            <div 
                                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                                style={{ backgroundColor: color }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
      )}

      {/* Chart Area - Explicit Height Enforced */}
      <div 
        className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm h-[500px] w-full relative flex-grow"
        onClick={(e) => {
           // Reset if clicking empty background area (not strictly perfect but works for UX)
           // Ideally checking e.target but SVG structure makes it hard.
           // Reliance on Chart onClick below is safer for Recharts.
           if(activeYear) setActiveYear(null);
        }}
      >
        {chartData.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <p className="text-lg">데이터가 없습니다.</p>
                <p className="text-sm mt-2">품종을 변경하거나 데이터를 확인해주세요.</p>
            </div>
        ) : (
            <ResponsiveContainer key={chartKey} width="100%" height="100%">
                <LineChart 
                    data={chartData} 
                    margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                    onClick={(_data, e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        // Don't trigger parent div click
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        label={{ value: '날짜 (월-일)', position: 'insideBottomRight', offset: -10, fill: '#9CA3AF', fontSize: 12 }}
                        interval="preserveStartEnd"
                        minTickGap={30}
                        padding={{ left: 10, right: 10 }}
                    />
                    <YAxis 
                        domain={['auto', 'auto']} 
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        label={{ value: '평균 Brix', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 12 }}
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '14px', fontWeight: 500 }}
                        labelFormatter={(label) => `${label} 기준`}
                    />
                    <Legend 
                        wrapperStyle={{ paddingTop: '10px', cursor: 'pointer' }} 
                        onClick={(e) => {
                             // Recharts Legend payload
                             handleLegendClick(e);
                        }}
                        formatter={(value, entry: any) => {
                            const isDimmed = activeYear !== null && activeYear !== value;
                            const displayValue = value.endsWith('년') ? value : `${value}년`;
                            return <span style={{ color: isDimmed ? '#9CA3AF' : '#1F2937', fontWeight: isDimmed ? 400 : 600 }}>{displayValue}</span>;
                        }}
                    />
                    {renderYears.map((year) => {
                        const originalIndex = years.indexOf(year);
                        const color = YEAR_COLORS[originalIndex % YEAR_COLORS.length];
                        
                        const isDimmed = activeYear !== null && activeYear !== year;
                        const isHighlighted = activeYear === year;
                        
                        return (
                            <Line
                                key={year}
                                type="monotone"
                                dataKey={year}
                                name={year}
                                stroke={color}
                                strokeWidth={isHighlighted ? 4 : (isDimmed ? 1 : 2.5)}
                                strokeOpacity={isDimmed ? 0.15 : 1}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                connectNulls={true} 
                                animationDuration={300}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default YearlyTrendAnalysis;
