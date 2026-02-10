import React from 'react';
import { DEVICE_PRESETS } from '../../../data/devicePresets';

export default function DeviceSimPanel({ value, onChange }) {
  const {
    enabled = false,
    deviceName = 'iPhone 12',
    width = 390,
    height = 844,
    orientation = 'portrait',
  } = value || {};

  const device = DEVICE_PRESETS.find((d) => d.name === deviceName);

  const update = (patch) => {
    if (!onChange) return;
    onChange({
      enabled,
      deviceName,
      width,
      height,
      orientation,
      ...patch,
    });
  };

  const handleSelect = (d) => {
    update({ enabled: true, deviceName: d.name, width: d.w, height: d.h });
  };

  const displayW = orientation === 'portrait' ? width : height;
  const displayH = orientation === 'portrait' ? height : width;

  return (
    <div className="tool-panel">
      <div className="device-sim__controls">
        <div className="device-sim__presets">
          {DEVICE_PRESETS.map((d) => (
            <button
              key={d.name}
              className={`device-sim__preset ${deviceName === d.name ? 'device-sim__preset--active' : ''}`}
              onClick={() => handleSelect(d)}
            >
              {d.name}
            </button>
          ))}
        </div>
        <div className="device-sim__dimensions">
          <input
            className="device-sim__dim-input"
            type="number"
            value={width}
            onChange={(e) => update({ enabled: true, deviceName: 'Custom', width: Number(e.target.value) })}
          />
          <span>×</span>
          <input
            className="device-sim__dim-input"
            type="number"
            value={height}
            onChange={(e) => update({ enabled: true, deviceName: 'Custom', height: Number(e.target.value) })}
          />
          <span>px</span>
          <span style={{ margin: '0 4px' }}>|</span>
          <button
            className={`device-sim__preset ${orientation === 'portrait' ? 'device-sim__preset--active' : ''}`}
            onClick={() => update({ enabled: true, orientation: 'portrait' })}
          >
            Portrait
          </button>
          <button
            className={`device-sim__preset ${orientation === 'landscape' ? 'device-sim__preset--active' : ''}`}
            onClick={() => update({ enabled: true, orientation: 'landscape' })}
          >
            Landscape
          </button>
          <span style={{ margin: '0 4px' }}>|</span>
          <button
            className={`device-sim__preset ${enabled ? 'device-sim__preset--active' : ''}`}
            onClick={() => update({ enabled: !enabled })}
          >
            {enabled ? 'Disable' : 'Enable'}
          </button>
          <button className="device-sim__preset" onClick={() => update({ enabled: false })}>
            Reset
          </button>
        </div>
      </div>
      <div className="tool-panel__body">
        <div className="tool-panel__empty">
          <div className="tool-panel__empty-icon">📱</div>
          <div className="tool-panel__empty-title">{deviceName}</div>
          <div className="tool-panel__empty-desc">
            {displayW} × {displayH} px
            <br />Type: {device?.type || 'Custom'}
            <br />
            <br />{enabled ? 'Simulation is active for the current tab.' : 'Enable to resize the active tab viewport.'}
          </div>
        </div>
      </div>
    </div>
  );
}
