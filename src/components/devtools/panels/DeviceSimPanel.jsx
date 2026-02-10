import React, { useState } from 'react';
import { DEVICE_PRESETS } from '../../../data/devicePresets';

export default function DeviceSimPanel() {
  const [selectedDevice, setSelectedDevice] = useState('iPhone 12');
  const [orientation, setOrientation] = useState('portrait');
  const [customW, setCustomW] = useState(390);
  const [customH, setCustomH] = useState(844);

  const device = DEVICE_PRESETS.find((d) => d.name === selectedDevice);

  const handleSelect = (d) => {
    setSelectedDevice(d.name);
    setCustomW(d.w);
    setCustomH(d.h);
  };

  return (
    <div className="tool-panel">
      <div className="device-sim__controls">
        <div className="device-sim__presets">
          {DEVICE_PRESETS.map((d) => (
            <button
              key={d.name}
              className={`device-sim__preset ${selectedDevice === d.name ? 'device-sim__preset--active' : ''}`}
              onClick={() => handleSelect(d)}
            >
              {d.name}
            </button>
          ))}
        </div>
        <div className="device-sim__dimensions">
          <input className="device-sim__dim-input" type="number" value={customW} onChange={(e) => setCustomW(+e.target.value)} />
          <span>×</span>
          <input className="device-sim__dim-input" type="number" value={customH} onChange={(e) => setCustomH(+e.target.value)} />
          <span>px</span>
          <span style={{ margin: '0 4px' }}>|</span>
          <button
            className={`device-sim__preset ${orientation === 'portrait' ? 'device-sim__preset--active' : ''}`}
            onClick={() => setOrientation('portrait')}
          >
            Portrait
          </button>
          <button
            className={`device-sim__preset ${orientation === 'landscape' ? 'device-sim__preset--active' : ''}`}
            onClick={() => setOrientation('landscape')}
          >
            Landscape
          </button>
        </div>
      </div>
      <div className="tool-panel__body">
        <div className="tool-panel__empty">
          <div className="tool-panel__empty-icon">📱</div>
          <div className="tool-panel__empty-title">{selectedDevice}</div>
          <div className="tool-panel__empty-desc">
            {orientation === 'portrait' ? `${customW} × ${customH}` : `${customH} × ${customW}`} px
            <br />Type: {device?.type || 'Custom'}
            <br />
            <br />The browser viewport will resize to simulate this device when connected to a live page.
          </div>
        </div>
      </div>
    </div>
  );
}
