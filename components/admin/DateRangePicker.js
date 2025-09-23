import { useState } from 'react';

export default function DateRangePicker({ startDate, endDate, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const handleStartDateChange = (e) => {
    const newStartDate = new Date(e.target.value);
    onChange({ start: newStartDate, end: endDate });
  };

  const handleEndDateChange = (e) => {
    const newEndDate = new Date(e.target.value);
    onChange({ start: startDate, end: newEndDate });
  };

  const presetRanges = [
    {
      label: 'Last 7 days',
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    {
      label: 'Last 30 days',
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    {
      label: 'Last 90 days',
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    {
      label: 'This month',
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date()
    }
  ];

  const handlePresetClick = (preset) => {
    onChange({ start: preset.start, end: preset.end });
    setIsOpen(false);
  };

  return (
    <div className="date-range-picker">
      <div className="date-inputs">
        <div className="input-group">
          <label>From:</label>
          <input
            type="date"
            value={formatDate(startDate)}
            onChange={handleStartDateChange}
          />
        </div>
        <div className="input-group">
          <label>To:</label>
          <input
            type="date"
            value={formatDate(endDate)}
            onChange={handleEndDateChange}
          />
        </div>
        <button 
          className="preset-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          Presets ▼
        </button>
      </div>

      {isOpen && (
        <div className="preset-dropdown">
          {presetRanges.map((preset, index) => (
            <button
              key={index}
              className="preset-option"
              onClick={() => handlePresetClick(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .date-range-picker {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .date-inputs {
          display: flex;
          gap: 16px;
          align-items: end;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-group label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .input-group input {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }

        .preset-button {
          padding: 8px 16px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          height: fit-content;
        }

        .preset-button:hover {
          background: #e5e7eb;
        }

        .preset-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 10;
          min-width: 150px;
        }

        .preset-option {
          display: block;
          width: 100%;
          padding: 8px 12px;
          text-align: left;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 14px;
        }

        .preset-option:hover {
          background: #f3f4f6;
        }

        .preset-option:first-child {
          border-radius: 6px 6px 0 0;
        }

        .preset-option:last-child {
          border-radius: 0 0 6px 6px;
        }
      `}</style>
    </div>
  );
}
