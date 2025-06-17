import React from 'react';

const SummaryCard = ({ title, value, children, valueClassName }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow duration-200 ease-in-out">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2 truncate" title={title}>
        {title}
      </h2>
      {value !== undefined && value !== null && (
        <p className={`text-2xl sm:text-3xl font-bold text-gray-900 ${valueClassName || ''}`}>
          {value}
        </p>
      )}
      {children && <div className="mt-2 text-sm text-gray-600">{children}</div>}
    </div>
  );
};

export default SummaryCard;
