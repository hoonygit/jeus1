
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BrixData, FilterState, ChartDataPoint } from './types';
import Card from './components/Card';
import FileUpload from './components/FileUpload';
import Filters from './components/Filters';
import BrixChart from './components/BrixChart';
import Loader from './components/Loader';
import ChartIcon from './components/icons/ChartIcon';
import FarmAnalysis from './components/FarmAnalysis';

// Helper function to safely parse a 'YYYY-MM-DD' string into a local Date object.
const parseDateAsLocal = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            // This creates the date in the user's local timezone.
            return new Date(year, month, day);
        }
    }
    return null;
};

// Helper function to format a Date object into a 'YYYY-MM-DD' string.
const formatDateToYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

type TabType = 'dashboard' | 'analysis';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [allData, setAllData] = useState<BrixData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [timeSeriesChartData, setTimeSeriesChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    farmlands: [],
    variety: 'ALL',
    startDate: '',
    endDate: '',
    dateFilterEnabled: false,
    year: 'ALL',
  });

  const farmerList = useMemo(() => Array.from(new Set(allData.map(d => d.FARMLAND))).sort(), [allData]);
  const varietyList = useMemo(() => Array.from(new Set(allData.map(d => d.VARIETY))).sort(), [allData]);
  const yearList = useMemo(() => ['ALL', ...Array.from(new Set(allData.map(d => d.MEASURE_DATE.getFullYear().toString()))).sort((a,b) => (b as string).localeCompare(a as string))], [allData]);

  const handleFileParsed = useCallback((parsedData: any[]) => {
    setError(null);
    setLoading(true);
    
    // Reset Data
    setAllData([]);
    setChartData([]);
    setTimeSeriesChartData([]);
    
    try {
        const formattedData: BrixData[] = parsedData
            .map((row: any) => {
                if (!row.MEASURE_DATE || !row.BRIX || !row.FARMLAND || !row.VARIETY) {
                    return null;
                }
                const measureDate = parseDateAsLocal(row.MEASURE_DATE);
                const brix = parseFloat(row.BRIX);
                
                if (!measureDate || isNaN(brix)) {
                    return null;
                }

                return {
                    FARMLAND: String(row.FARMLAND).trim(),
                    MSSR_SN: row.MSSR_SN,
                    VARIETY: String(row.VARIETY).trim(),
                    TAG_NO: Number(row.TAG_NO),
                    BRIX: brix,
                    MEASURE_DATE: measureDate,
                };
            })
            .filter((d): d is BrixData => d !== null);

      if(formattedData.length === 0) {
        setError('유효한 데이터가 없습니다. BRIX 또는 MEASURE_DATE 컬럼을 확인해주세요.');
        setLoading(false);
        return;
      }
      
      formattedData.sort((a,b) => a.MEASURE_DATE.getTime() - b.MEASURE_DATE.getTime());
      
      const firstDate = formattedData[0].MEASURE_DATE;
      const lastDate = formattedData[formattedData.length - 1].MEASURE_DATE;

      // Reset Filters
      setFilters({
        farmlands: [],
        variety: 'ALL',
        startDate: formatDateToYYYYMMDD(firstDate),
        endDate: formatDateToYYYYMMDD(lastDate),
        dateFilterEnabled: false,
        year: 'ALL'
      });

      // Important: Set data and switch to dashboard to trigger processing
      setAllData(formattedData);
      setActiveTab('dashboard');

    } catch (e) {
      setError('데이터 처리 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
      console.error(e);
      setLoading(false);
    }
  }, []);

  // Main Data Processing Effect
  useEffect(() => {
    if (allData.length === 0) return;
    
    // Only process dashboard chart data if we are on the dashboard tab
    if (activeTab !== 'dashboard') return;

    setLoading(true);

    const processData = () => {
        const { farmlands, variety, startDate, endDate, dateFilterEnabled, year } = filters;
        
        // 1. Base Filtering (Variety & Year)
        let filteredBase = allData;
        if (!dateFilterEnabled && year !== 'ALL') {
             filteredBase = filteredBase.filter(d => d.MEASURE_DATE.getFullYear().toString() === year);
        }
        if (variety !== 'ALL') {
             filteredBase = filteredBase.filter(d => d.VARIETY === variety);
        }
        
        // 2. Branch Logic: Time Series vs Categorical
        if (dateFilterEnabled) {
            // --- TIME SERIES LOGIC (Cumulative Average) ---
            
            // Aggregate daily totals first
            const dailyAggregates = new Map<string, any>();
            for (const item of filteredBase) {
                const dateStr = formatDateToYYYYMMDD(item.MEASURE_DATE);
                if (!dailyAggregates.has(dateStr)) {
                    dailyAggregates.set(dateStr, { 
                        dateObj: item.MEASURE_DATE,
                        daily_total: 0, 
                        daily_count: 0 
                    });
                }
                const dateAgg = dailyAggregates.get(dateStr)!;
                
                dateAgg.daily_total += item.BRIX;
                dateAgg.daily_count += 1;
        
                if (farmlands.includes(item.FARMLAND)) {
                    const farmTotalKey = `${item.FARMLAND}_total`;
                    const farmCountKey = `${item.FARMLAND}_count`;
                    dateAgg[farmTotalKey] = (dateAgg[farmTotalKey] || 0) + item.BRIX;
                    dateAgg[farmCountKey] = (dateAgg[farmCountKey] || 0) + 1;
                }
            }
            
            const sortedDates = Array.from(dailyAggregates.keys()).sort();
            const computedAveragesMap = new Map<string, { overall?: number, farms: Record<string, number> }>();

            let currentYear = '';
            let cumulativeSum = 0;
            let cumulativeCount = 0;
            const farmCumulativeStats = new Map<string, { sum: number, count: number }>();
            
            // Compute Cumulative Averages
            for (const dateStr of sortedDates) {
                const agg = dailyAggregates.get(dateStr);
                const rowYear = agg.dateObj.getFullYear().toString();

                // Reset on year change
                if (rowYear !== currentYear) {
                    currentYear = rowYear;
                    cumulativeSum = 0;
                    cumulativeCount = 0;
                    farmCumulativeStats.clear();
                }

                // Overall Cumulative
                if (agg.daily_count > 0) {
                    cumulativeSum += agg.daily_total;
                    cumulativeCount += agg.daily_count;
                }

                const computedEntry: { overall?: number, farms: Record<string, number> } = { farms: {} };

                if (cumulativeCount > 0) {
                    computedEntry.overall = parseFloat((cumulativeSum / cumulativeCount).toFixed(2));
                }

                // Farm Cumulative
                for (const farm of farmlands) {
                    const farmTotal = agg[`${farm}_total`];
                    const farmCount = agg[`${farm}_count`];
                    
                    if (!farmCumulativeStats.has(farm)) {
                        farmCumulativeStats.set(farm, { sum: 0, count: 0 });
                    }
                    const farmStats = farmCumulativeStats.get(farm)!;

                    if (farmTotal !== undefined && farmCount > 0) {
                        farmStats.sum += farmTotal;
                        farmStats.count += farmCount;
                        // Store cumulative average
                        computedEntry.farms[farm] = parseFloat((farmStats.sum / farmStats.count).toFixed(2));
                    }
                }
                
                if (computedEntry.overall !== undefined || Object.keys(computedEntry.farms).length > 0) {
                    computedAveragesMap.set(dateStr, computedEntry);
                }
            }

            // Fill Date Range & Handle Gaps
            const finalTimeSeriesData: ChartDataPoint[] = [];
            const start = parseDateAsLocal(startDate);
            const end = parseDateAsLocal(endDate);
            const MAX_GAP_DAYS = 0;

            if (start && end && end >= start) {
                let lastKnownOverall: number | null = null;
                let lastDateOverall: Date | null = null;
                let lastKnownYear: string = '';

                // Try to find initial last known for overall average before start date
                if (start) {
                     const startYear = start.getFullYear().toString();
                     const startTs = start.getTime();
                     for (let i = sortedDates.length - 1; i >= 0; i--) {
                         const dStr = sortedDates[i];
                         const dObj = parseDateAsLocal(dStr);
                         if (dObj && dObj.getTime() < startTs && dObj.getFullYear().toString() === startYear) {
                             const computed = computedAveragesMap.get(dStr);
                             if (computed && computed.overall !== undefined) {
                                 lastKnownOverall = computed.overall;
                                 lastDateOverall = dObj;
                                 lastKnownYear = startYear;
                                 break; 
                             }
                         }
                     }
                }

                for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
                    const dateStr = formatDateToYYYYMMDD(currentDate);
                    const currentYearStr = currentDate.getFullYear().toString();
                    const currentTime = currentDate.getTime();

                    if (currentYearStr !== lastKnownYear) {
                        lastKnownOverall = null;
                        lastDateOverall = null;
                        lastKnownYear = currentYearStr;
                    }

                    const computed = computedAveragesMap.get(dateStr);
                    const point: ChartDataPoint = { date: dateStr };
                    
                    // Overall Average: Cumulative + Gap Filling
                    if (computed && computed.overall !== undefined) {
                        point['전체 평균'] = computed.overall;
                        lastKnownOverall = computed.overall;
                        lastDateOverall = new Date(currentDate);
                    } else if (lastKnownOverall !== null && lastDateOverall) {
                        const diffTime = Math.abs(currentTime - lastDateOverall.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        if (diffDays <= MAX_GAP_DAYS) {
                            point['전체 평균'] = lastKnownOverall;
                        }
                    }

                    // Farm Data: Cumulative Average, ONLY on days with actual data
                    for (const farm of farmlands) {
                        if (computed && computed.farms && computed.farms[farm] !== undefined) {
                            point[farm] = computed.farms[farm];
                        }
                    }

                    finalTimeSeriesData.push(point);
                }
            }
            
            setTimeSeriesChartData(finalTimeSeriesData);
            setChartData([]);

        } else {
            // --- CATEGORICAL LOGIC (Bar Chart: Variety Comparison) ---
            
            // We don't filter by date range here (unless requested), we use the filteredBase which already handles Year/Variety
            const dataByVariety = new Map<string, any>();
            
            for (const item of filteredBase) {
                const itemVariety = item.VARIETY;
                if (!dataByVariety.has(itemVariety)) {
                    dataByVariety.set(itemVariety, { overall_total: 0, overall_count: 0 });
                }
                const varietyAgg = dataByVariety.get(itemVariety)!;
                varietyAgg.overall_total += item.BRIX;
                varietyAgg.overall_count += 1;

                if (farmlands.includes(item.FARMLAND)) {
                    const farmTotalKey = `${item.FARMLAND}_total`;
                    const farmCountKey = `${item.FARMLAND}_count`;
                    varietyAgg[farmTotalKey] = (varietyAgg[farmTotalKey] || 0) + item.BRIX;
                    varietyAgg[farmCountKey] = (varietyAgg[farmCountKey] || 0) + 1;
                }
            }
        
            const finalChartData = Array.from(dataByVariety.entries()).map(([v, aggs]) => {
                const point: ChartDataPoint = { variety: v };
                if (aggs.overall_count > 0) {
                    point['전체 평균'] = parseFloat((aggs.overall_total / aggs.overall_count).toFixed(2));
                }
                for (const farm of farmlands) {
                    const total = aggs[`${farm}_total`], count = aggs[`${farm}_count`];
                    if (total !== undefined && count > 0) {
                        point[farm] = parseFloat((total / count).toFixed(2));
                    }
                }
                return point;
            })
            .filter(p => Object.keys(p).length > 1) // Ensure at least one data point exists
            .sort((a, b) => (a.variety as string).localeCompare(b.variety as string));

            setChartData(finalChartData);
            setTimeSeriesChartData([]);
        }
    };

    // Small delay to allow state to settle, but fast enough to feel instant
    const timer = setTimeout(() => {
      processData();
      setLoading(false);
    }, 50); 

    return () => clearTimeout(timer);
    
  }, [allData, filters, activeTab]);


  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center">
            <span className="text-primary mr-3">🍊</span> 감귤 당도 분석 대시보드
          </h1>
          <p className="text-text-secondary mt-2">CSV 데이터를 업로드하여 당도 추이를 시각적으로 분석하세요.</p>
        </header>

        <main className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-96 flex-shrink-0 flex flex-col gap-8">
            <Card>
              <h2 className="text-xl font-semibold mb-4">데이터 가져오기</h2>
              <FileUpload onFileParsed={handleFileParsed} setLoading={setLoading} setError={setError} />
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            </Card>
            {/* Only show main filters if on dashboard tab and data exists */}
            {allData.length > 0 && activeTab === 'dashboard' && (
              <Card>
                <h2 className="text-xl font-semibold mb-4">필터</h2>
                <Filters filters={filters} onFilterChange={setFilters} farmerList={farmerList} varietyList={varietyList} />
              </Card>
            )}
             {/* Information Card for Analysis Tab */}
             {allData.length > 0 && activeTab === 'analysis' && (
                <Card>
                    <h2 className="text-xl font-semibold mb-2">개별 농가 분석</h2>
                    <p className="text-sm text-text-secondary">
                        특정 농가의 데이터를 심층적으로 분석합니다. 우측 패널에서 농가를 선택하고 상세 정보를 확인하세요.
                    </p>
                </Card>
            )}
          </aside>

          <section className="flex-grow flex flex-col h-full">
             {/* Tabs */}
             {allData.length > 0 && (
                 <div className="flex space-x-1 mb-0">
                     <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-6 py-3 rounded-t-lg font-medium text-sm transition-colors ${
                            activeTab === 'dashboard' 
                            ? 'bg-white text-primary border-t-4 border-primary shadow-sm' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                     >
                        종합 분석
                     </button>
                     <button
                        onClick={() => setActiveTab('analysis')}
                        className={`px-6 py-3 rounded-t-lg font-medium text-sm transition-colors ${
                            activeTab === 'analysis' 
                            ? 'bg-white text-primary border-t-4 border-primary shadow-sm' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                     >
                        개별 농가 분석
                     </button>
                 </div>
             )}

            <Card className={`flex-grow min-h-[600px] lg:max-h-[calc(100vh-12rem)] rounded-tl-none ${allData.length > 0 ? 'rounded-tl-none' : 'rounded-xl'}`}>
                {allData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center">
                        <ChartIcon className="w-16 h-16 text-gray-300 mb-4"/>
                        <h2 className="text-2xl font-semibold text-text">분석을 시작하세요</h2>
                        <p className="text-text-secondary mt-2">좌측 패널에서 당도 데이터가 포함된 CSV 파일을 업로드해주세요.</p>
                    </div>
                ) : loading ? (
                    <div className="flex items-center justify-center h-full min-h-[500px]">
                        <Loader message="데이터를 분석 중입니다..." />
                    </div>
                ) : (
                    <>
                        {activeTab === 'dashboard' && (
                            <BrixChart 
                                data={chartData} 
                                timeSeriesData={timeSeriesChartData} 
                                selectedFarmlands={filters.farmlands}
                                filters={filters}
                                onFilterChange={setFilters}
                                yearList={yearList}
                            />
                        )}
                        {activeTab === 'analysis' && (
                            <FarmAnalysis 
                                data={allData}
                                farmerList={farmerList}
                            />
                        )}
                    </>
                )}
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;
