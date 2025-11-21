
import React, { useState, useCallback, useMemo } from 'react';
import type { BrixData } from './types';
import Card from './components/Card';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import ChartIcon from './components/icons/ChartIcon';
import FarmAnalysis from './components/FarmAnalysis';
import YearlyTrendAnalysis from './components/YearlyTrendAnalysis';

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

type TabType = 'farmAnalysis' | 'yearlyTrend';

const App: React.FC = () => {
  const [allData, setAllData] = useState<BrixData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('farmAnalysis');

  // Memoize farmer list derived from data
  const farmerList = useMemo(() => {
      if (allData.length === 0) return [];
      return Array.from(new Set(allData.map(d => d.FARMLAND))).sort();
  }, [allData]);

  const handleFileParsed = useCallback((parsedData: any[]) => {
    setError(null);
    setLoading(true);
    
    try {
        const formattedData: BrixData[] = parsedData
            .map((row: any) => {
                // Validate essential fields
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
      
      // Sort by date initially
      formattedData.sort((a,b) => a.MEASURE_DATE.getTime() - b.MEASURE_DATE.getTime());
      setAllData(formattedData);
      
    } catch (e) {
      setError('데이터 처리 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center">
            <span className="text-primary mr-3">🍊</span> 감귤 당도 분석 대시보드
          </h1>
          <p className="text-text-secondary mt-2">CSV 데이터를 업로드하여 농가별 당도 추이 및 연도별 변화를 심층적으로 분석하세요.</p>
        </header>

        <main className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-80 flex-shrink-0 flex flex-col gap-8">
            <Card>
              <h2 className="text-xl font-semibold mb-4">데이터 가져오기</h2>
              <FileUpload onFileParsed={handleFileParsed} setLoading={setLoading} setError={setError} />
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
            </Card>
          </aside>

          <section className="flex-grow flex flex-col h-full">
            <Card className={`flex-grow min-h-[600px] lg:max-h-[calc(100vh-12rem)] flex flex-col ${allData.length > 0 ? '' : 'rounded-xl'}`}>
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
                    <div className="h-full flex flex-col">
                        {/* Tab Navigation */}
                        <div className="flex-none border-b border-gray-200 mb-4">
                            <button
                                className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors duration-200 ${
                                    activeTab === 'farmAnalysis'
                                        ? 'text-primary border-b-2 border-primary'
                                        : 'text-text-secondary hover:text-text'
                                }`}
                                onClick={() => setActiveTab('farmAnalysis')}
                            >
                                개별 농가 분석
                            </button>
                            <button
                                className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors duration-200 ${
                                    activeTab === 'yearlyTrend'
                                        ? 'text-primary border-b-2 border-primary'
                                        : 'text-text-secondary hover:text-text'
                                }`}
                                onClick={() => setActiveTab('yearlyTrend')}
                            >
                                연도별 추세 분석
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-grow h-full overflow-y-auto">
                            {activeTab === 'farmAnalysis' ? (
                                <FarmAnalysis 
                                    data={allData}
                                    farmerList={farmerList}
                                />
                            ) : (
                                <YearlyTrendAnalysis data={allData} />
                            )}
                        </div>
                    </div>
                )}
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;
