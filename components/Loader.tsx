
import React from 'react';

const Loader = ({ message = '처리 중...' }: { message?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-text-secondary">{message}</p>
    </div>
  );
};

export default Loader;
