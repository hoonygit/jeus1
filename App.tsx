
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BrixData, FilterState, ChartDataPoint } from './types';
import Card from './components/Card';
import FileUpload from './components/FileUpload';
import Filters from './components/Filters';
import BrixChart from './components/BrixChart';
import Loader from './components/Loader';
import ChartIcon from './components/icons/ChartIcon';

// Helper function to safely parse a 'YYYY-MM-DD' string into a local Date object.
// This avoids timezone issues where `new Date('YYYY-MM-DD')` might result in the previous day.
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


const App: React.FC = () => {
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
    // Reset all states for the new file to ensure a clean slate
    setError(null);
    setAllData([]);
    setChartData([]);
    setTimeSeriesChartData([]);
    
    try {
        // More robust data parsing and cleaning
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
        return;
      }
      
      formattedData.sort((a,b) => a.MEASURE_DATE.getTime() - b.MEASURE_DATE.getTime());
      
      setAllData(formattedData);

      const firstDate = formattedData[0].MEASURE_DATE;
      const lastDate = formattedData[formattedData.length - 1].MEASURE_DATE;

      // Reset filters to show overall average by default, ensuring the initial chart is not empty.
      setFilters({
        farmlands: [],
        variety: 'ALL',
        startDate: formatDateToYYYYMMDD(firstDate),
        endDate: formatDateToYYYYMMDD(lastDate),
        dateFilterEnabled: false,
        year: 'ALL'
      });

    } catch (e) {
      setError('데이터 처리 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (allData.length === 0) return;
    setLoading(true);

    const processData = () => {
        const { farmlands, variety, startDate, endDate, dateFilterEnabled, year } = filters;
        
        // 1. Filter by Variety first (and Year if date filter is OFF)
        // Note: When dateFilterEnabled is true, we do NOT filter by date range yet.
        // We need the full year's data to calculate the cumulative average correctly.
        let filteredByVariety = allData;

        if (!dateFilterEnabled && year !== 'ALL') {
             filteredByVariety = filteredByVariety.filter(d => d.MEASURE_DATE.getFullYear().toString() === year);
        }

        if (variety !== 'ALL') {
             filteredByVariety = filteredByVariety.filter(d => d.VARIETY === variety);
        }
        
        if (dateFilterEnabled) {
            // --- Time-series chart logic ---
            // OVERALL AVERAGE: Cumulative Average (Year-to-Date)
            // FARM DATA: Cumulative Average (Year-to-Date), BUT only displayed on days with measurements.

            // Step A: Aggregate daily stats (Total Brix, Count) for all available data
            const dailyAggregates = new Map<string, any>();

            for (const item of filteredByVariety) {
                const dateStr = formatDateToYYYYMMDD(item.MEASURE_DATE);
                if (!dailyAggregates.has(dateStr)) {
                    dailyAggregates.set(dateStr, { 
                        dateObj: item.MEASURE_DATE,
                        daily_total: 0, 
                        daily_count: 0 
                    });
                }
                const dateAgg = dailyAggregates.get(dateStr)!;
                
                // Accumulate daily total (for later cumulative calculation for Overall)
                dateAgg.daily_total += item.BRIX;
                dateAgg.daily_count += 1;
        
                // Individual Farm Data (Daily specific aggregation)
                if (farmlands.includes(item.FARMLAND)) {
                    const farmTotalKey = `${item.FARMLAND}_total`;
                    const farmCountKey = `${item.FARMLAND}_count`;
                    dateAgg[farmTotalKey] = (dateAgg[farmTotalKey] || 0) + item.BRIX;
                    dateAgg[farmCountKey] = (dateAgg[farmCountKey] || 0) + 1;
                }
            }
            
            // Step B: Calculate Averages
            const sortedDates = Array.from(dailyAggregates.keys()).sort();
            const computedAveragesMap = new Map<string, { overall?: number, farms: Record<string, number> }>();

            let currentYear = '';
            
            // Overall cumulative trackers
            let cumulativeSum = 0;
            let cumulativeCount = 0;

            // Farm cumulative trackers: Map<FarmName, { sum, count }>
            const farmCumulativeStats = new Map<string, { sum: number, count: number }>();
            
            // We iterate through ALL sorted dates to build the running averages correctly
            for (const dateStr of sortedDates) {
                const agg = dailyAggregates.get(dateStr);
                const rowYear = agg.dateObj.getFullYear().toString();

                if (rowYear !== currentYear) {
                    // Year changed, reset all cumulative stats
                    currentYear = rowYear;
                    cumulativeSum = 0;
                    cumulativeCount = 0;
                    farmCumulativeStats.clear();
                }

                // 1. Calculate Overall Cumulative Average
                if (agg.daily_count > 0) {
                    cumulativeSum += agg.daily_total;
                    cumulativeCount += agg.daily_count;
                }

                const computedEntry: { overall?: number, farms: Record<string, number> } = { farms: {} };

                if (cumulativeCount > 0) {
                    computedEntry.overall = parseFloat((cumulativeSum / cumulativeCount).toFixed(2));
                }

                // 2. Calculate Farm Cumulative Average (Only if data exists for that day)
                for (const farm of farmlands) {
                    const farmTotal = agg[`${farm}_total`];
                    const farmCount = agg[`${farm}_count`];
                    
                    // Initialize tracker if not exists
                    if (!farmCumulativeStats.has(farm)) {
                        farmCumulativeStats.set(farm, { sum: 0, count: 0 });
                    }
                    const farmStats = farmCumulativeStats.get(farm)!;

                    // If there is measurement data for this farm on this day
                    if (farmTotal !== undefined && farmCount > 0) {
                        // Update cumulative stats
                        farmStats.sum += farmTotal;
                        farmStats.count += farmCount;
                        
                        // Calculate and store CUMULATIVE average for display
                        computedEntry.farms[farm] = parseFloat((farmStats.sum / farmStats.count).toFixed(2));
                    }
                    // If no data for this day, we do NOTHING. 
                    // We preserve the cumulative stats (farmStats) for the next calculation, 
                    // but we do NOT add an entry to computedEntry.farms, so no bar is drawn.
                }
                
                if (computedEntry.overall !== undefined || Object.keys(computedEntry.farms).length > 0) {
                    computedAveragesMap.set(dateStr, computedEntry);
                }
            }

            // Step C: Generate final chart data for the selected range
            const finalTimeSeriesData: ChartDataPoint[] = [];
            const start = parseDateAsLocal(startDate);
            const end = parseDateAsLocal(endDate);

            // Threshold for breaking the graph line (Only applies to Overall Average)
            const MAX_GAP_DAYS = 0;

            if (start && end && end >= start) {
                // State to track the "last known average" for Overall Gap filling
                let lastKnownOverall: number | null = null;
                let lastDateOverall: Date | null = null;
                let lastKnownYear: string = '';

                // Optimization: Pre-scan backwards to find initial carry-over value for Overall Average
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

                // Loop through every day in the selected filter range
                for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
                    const dateStr = formatDateToYYYYMMDD(currentDate);
                    const currentYearStr = currentDate.getFullYear().toString();
                    const currentTime = currentDate.getTime();

                    // Reset Overall carry-over if we crossed into a new year
                    if (currentYearStr !== lastKnownYear) {
                        lastKnownOverall = null;
                        lastDateOverall = null;
                        lastKnownYear = currentYearStr;
                    }

                    const computed = computedAveragesMap.get(dateStr);
                    const point: ChartDataPoint = { date: dateStr };
                    
                    // 1. Set Overall Average (Cumulative with Gap Check)
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

                    // 2. Set Farm Data (Cumulative, only if exists today)
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
            // --- Variety comparison bar chart logic (unchanged) ---
            let finalFilteredData = filteredByVariety;
            if (dateFilterEnabled) {
                 const start = parseDateAsLocal(startDate);
                 let end = parseDateAsLocal(endDate);
                 if(end) end.setHours(23, 59, 59, 999);
                 finalFilteredData = finalFilteredData.filter(d => {
                    const date = d.MEASURE_DATE;
                    return (!start || date >= start) && (!end || date <= end);
                 });
            }

            const dataByVariety = new Map<string, any>();
            for (const item of finalFilteredData) {
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
            }).filter(p => Object.keys(p).length > 1).sort((a, b) => (a.variety as string).localeCompare(b.variety as string));

            setChartData(finalChartData);
            setTimeSeriesChartData([]);
        }
    };

    const timer = setTimeout(() => {
      processData();
      setLoading(false);
    }, 300); // Debounce processing

    return () => clearTimeout(timer);
    
  }, [allData, filters]);


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
            {allData.length > 0 && (
              <Card>
                <h2 className="text-xl font-semibold mb-4">필터</h2>
                <Filters filters={filters} onFilterChange={setFilters} farmerList={farmerList} varietyList={varietyList} />
              </Card>
            )}
          </aside>

          <section className="flex-grow">
            <Card className="h-full min-h-[600px] lg:max-h-[calc(100vh-12rem)]">
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
                    <BrixChart 
                        data={chartData} 
                        timeSeriesData={timeSeriesChartData} 
                        selectedFarmlands={filters.farmlands}
                        filters={filters}
                        onFilterChange={setFilters}
                        yearList={yearList}
                    />
                )}
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;
