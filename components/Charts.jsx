import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label
} from 'recharts';

export const WeeklyLeadsChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500">No data available for weekly leads chart.</p>;
  }

  // Ensure data is sorted by week_start_date for correct line chart rendering
  const sortedData = [...data].sort((a, b) => new Date(a.week_start_date) - new Date(b.week_start_date));


  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={sortedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="week_start_date"
          tickFormatter={(dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis allowDecimals={false}>
           <Label value="Number of Leads" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
        </YAxis>
        <Tooltip
            labelFormatter={(label) => `Week of: ${new Date(label).toLocaleDateString()}`}
            formatter={(value) => [value, 'Leads']}
        />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} name="Leads per Week" />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const MetaAdsPerformanceChart = ({ data }) => {
   if (!data || data.length === 0) {
    return <p className="text-center text-gray-500">No data available for Meta Ads performance chart.</p>;
  }

  // Aggregate data by campaign_name for spend and leads
  const aggregatedData = data.reduce((acc, item) => {
    const campaign = item.campaign_name || 'Unknown Campaign';
    if (!acc[campaign]) {
      acc[campaign] = { name: campaign, spend: 0, leads: 0 };
    }
    acc[campaign].spend += item.spend || 0;
    acc[campaign].leads += item.leads || 0;
    return acc;
  }, {});

  const chartData = Object.values(aggregatedData);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 50 /* Increased bottom margin for rotated labels */ }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
            dataKey="name"
            angle={-45} // Rotate labels
            textAnchor="end" // Anchor rotated labels at the end
            height={70} // Increase height to accommodate rotated labels
            interval={0} // Show all labels
         />
        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" allowDecimals={false}>
          <Label value="Spend ($)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
        </YAxis>
        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" allowDecimals={false}>
           <Label value="Leads" angle={-90} position="insideRight" style={{ textAnchor: 'middle' }} />
        </YAxis>
        <Tooltip
            formatter={(value, name, props) => {
                if (name === 'Spend') return [`$${parseFloat(value).toFixed(2)}`, 'Spend'];
                return [value, 'Leads'];
            }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="spend" fill="#8884d8" name="Spend" />
        <Bar yAxisId="right" dataKey="leads" fill="#82ca9d" name="Leads" />
      </BarChart>
    </ResponsiveContainer>
  );
};
