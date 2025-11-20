import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { YandereLedger } from '../types';

interface Props {
  ledger: YandereLedger;
}

const StatusLedger: React.FC<Props> = ({ ledger }) => {
  // Corrected and completed data array for RadarChart based on YandereLedger properties
  const data = [
    { subject: 'Integrity', A: ledger.physicalIntegrity, fullMark: 100 },
    { subject: 'Trauma', A: ledger.traumaLevel, fullMark: 100 },
    { subject: 'Shame', A: ledger.shamePainAbyssLevel, fullMark: 100 },
    { subject: 'Compliance', A: ledger.complianceScore, fullMark: 100 },
    { subject: 'Fear', A: ledger.fearOfAuthority, fullMark: 100 },
    { subject: 'Validation', A: ledger.desireForValidation, fullMark: 100 },
    { subject: 'Manipulation', A: ledger.capacityForManipulation, fullMark: 100 },
    { subject: 'Hope', A: ledger.hopeLevel, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} className="font-mono text-xs">
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#a8a29e' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#a8a29e', fontSize: '8px' }} />
        <Radar name="Subject 84" dataKey="A" stroke="#be123c" fill="#be123c" fillOpacity={0.6} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(28,25,23,0.9)',
            borderColor: '#be123c',
            color: '#e7e5e4',
            fontSize: '10px',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            padding: '8px',
          }}
          itemStyle={{ color: '#e7e5e4' }}
          labelStyle={{ color: '#be123c', marginBottom: '4px' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default StatusLedger;