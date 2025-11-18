import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BrixData, FilterState, ChartDataPoint } from './types';
import Card from './components/Card';
import FileUpload from './components/FileUpload';
import Filters from './components/Filters';
import BrixChart from './components/BrixChart';
import Loader from './components/Loader';
import ChartIcon from './components/icons/ChartIcon';

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
  // Fix: Added type assertion for sort parameters to resolve error on 'localeCompare'.
  const yearList = useMemo(() => ['ALL', ...Array.from(new Set(allData.map(d => d.MEASURE_DATE.getFullYear().toString()))).sort((a,b) => (b as string).localeCompare(a as string))], [allData]);

  const handleFileParsed = useCallback((parsedData: any[]) => {
    setError(null);
    try {
      const formattedData: BrixData[] = parsedData.map((row: any) => ({
        FARMLAND: row.FARMLAND,
        MSSR_SN: row.MSSR_SN,
        VARIETY: row.VARIETY,
        TAG_NO: Number(row.TAG_NO),
        BRIX: parseFloat(row.BRIX),
        MEASURE_DATE: new Date(row.MEASURE_DATE),
      })).filter(d => !isNaN(d.BRIX) && d.MEASURE_DATE.toString() !== 'Invalid Date');

      if(formattedData.length === 0) {
        setError('유효한 데이터가 없습니다. BRIX 또는 MEASURE_DATE 컬럼을 확인해주세요.');
        return;
      }
      
      formattedData.sort((a,b) => a.MEASURE_DATE.getTime() - b.MEASURE_DATE.getTime());
      
      setAllData(formattedData);

      const firstDate = formattedData[0].MEASURE_DATE;
      const lastDate = formattedData[formattedData.length - 1].MEASURE_DATE;

      setFilters(prev => ({
        ...prev,
        farmlands: [],
        variety: 'ALL',
        startDate: firstDate.toISOString().split('T')[0],
        endDate: lastDate.toISOString().split('T')[0],
        dateFilterEnabled: false,
        year: 'ALL'
      }));

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
        
        // 1. Filter data based on year or date range
        let baseFilteredData = allData;
        if (dateFilterEnabled) {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if(start) start.setHours(0,0,0,0);
            if(end) end.setHours(23,59,59,999);

            baseFilteredData = baseFilteredData.filter(d => {
                const date = d.MEASURE_DATE;
                const isAfterStart = !start || date >= start;
                const isBeforeEnd = !end || date <= end;
                return isAfterStart && isBeforeEnd;
            });
        } else if (year !== 'ALL') {
            baseFilteredData = baseFilteredData.filter(d => d.MEASURE_DATE.getFullYear().toString() === year);
        }

        // 2. Filter by variety
        const filteredByVariety = variety === 'ALL'
            ? baseFilteredData
            : baseFilteredData.filter(d => d.VARIETY === variety);
        
        // 3. Calculate chart data based on mode (dateFilterEnabled)
        if (dateFilterEnabled) {
            // Time-series chart logic
            const dataByDate = new Map<string, any>();

            for (const item of filteredByVariety) {
                const dateStr = item.MEASURE_DATE.toISOString().split('T')[0];
                if (!dataByDate.has(dateStr)) {
                    dataByDate.set(dateStr, { overall_total: 0, overall_count: 0 });
                }
                const dateAgg = dataByDate.get(dateStr)!;
                dateAgg.overall_total += item.BRIX;
                dateAgg.overall_count += 1;
        
                if (farmlands.includes(item.FARMLAND)) {
                    const farmTotalKey = `${item.FARMLAND}_total`;
                    const farmCountKey = `${item.FARMLAND}_count`;
                    dateAgg[farmTotalKey] = (dateAgg[farmTotalKey] || 0) + item.BRIX;
                    dateAgg[farmCountKey] = (dateAgg[farmCountKey] || 0) + 1;
                }
            }

            const finalTimeSeriesData = Array.from(dataByDate.entries()).map(([date, aggs]) => {
                const point: ChartDataPoint = { date };
                if (aggs.overall_count > 0) {
                    point['전체 평균'] = parseFloat((aggs.overall_total / aggs.overall_count).toFixed(2));
                }
                for (const farm of farmlands) {
                    const total = aggs[`${farm}_total`], count = aggs[`${farm}_count`];
                    if (total && count > 0) {
                        point[farm] = parseFloat((total / count).toFixed(2));
                    }
                }
                return point;
            }).filter(p => Object.keys(p).length > 1).sort((a, b) => (a.date as string).localeCompare(b.date as string));
            
            setTimeSeriesChartData(finalTimeSeriesData);
            setChartData([]);

        } else {
            // Variety comparison bar chart logic
            const dataByVariety = new Map<string, any>();

            for (const item of filteredByVariety) {
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
                    if (total && count > 0) {
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
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center">
            <span className="text-primary mr-3">🍊</span> 감귤 당도 분석 대시보드
          </h1>
          <p className="text-text-secondary mt-2">CSV 데이터를 업로드하여 당도 추이를 시각적으로 분석하세요.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1 flex flex-col gap-8">
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

          <section className="lg:col-span-3">
            <Card className="h-full max-h-[calc(100vh-10rem)]">
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
