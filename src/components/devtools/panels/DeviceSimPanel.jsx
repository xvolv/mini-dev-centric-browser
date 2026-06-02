import React, { useState, useEffect } from "react";
import { DEVICE_PRESETS } from "../../../data/devicePresets";
import { RotateCw, Maximize, Smartphone, Tablet, Columns, Square } from "lucide-react";

export default function DeviceSimPanel({ value, onChange }) {
  const [customW, setCustomW] = useState(value?.width || 390);
  const [customH, setCustomH] = useState(value?.height || 844);

  const mode = value?.mode || "single";
  const multiDevices = value?.multiDevices || ["iPhone 12", "Desktop"];

  useEffect(() => {
    if (value?.deviceName === "Custom") {
      setCustomW(value.width);
      setCustomH(value.height);
    }
  }, [value?.width, value?.height, value?.deviceName]);

  const setMode = (newMode) => {
    onChange({ ...value, mode: newMode });
  };

  const handleMultiDeviceChange = (index, presetName) => {
    const newDevices = [...multiDevices];
    newDevices[index] = presetName;
    onChange({ ...value, multiDevices: newDevices });
  };

  const handlePresetChange = (e) => {
    const presetName = e.target.value;
    if (presetName === "Custom") {
      onChange({
        ...value,
        deviceName: "Custom",
        width: parseInt(customW, 10) || 390,
        height: parseInt(customH, 10) || 844,
      });
      return;
    }
    const preset = DEVICE_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      onChange({
        ...value,
        deviceName: preset.name,
        width: preset.w,
        height: preset.h,
      });
    }
  };

  const handleCustomChange = (field, val) => {
    if (field === "w") setCustomW(val);
    if (field === "h") setCustomH(val);
  };
  
  const applyCustomDimensions = () => {
    let w = parseInt(customW, 10) || 390;
    let h = parseInt(customH, 10) || 844;
    w = Math.max(200, Math.min(w, 4000));
    h = Math.max(200, Math.min(h, 4000));
    setCustomW(w);
    setCustomH(h);
    onChange({
      ...value,
      width: w,
      height: h,
      deviceName: "Custom",
    });
  };

  const toggleOrientation = () => {
    onChange({
      ...value,
      orientation: value.orientation === "portrait" ? "landscape" : "portrait",
    });
  };

  const handleZoomChange = (e) => {
    onChange({
      ...value,
      zoom: e.target.value,
    });
  };

  return (
    <div className="tool-panel device-sim-panel">
      <div className="device-sim-panel__header">
        <h3>Responsive Device Simulator</h3>
      </div>

      <div className="device-sim-panel__section">
        <div className="device-sim-panel__btn-group">
          <button 
            className={`device-sim-panel__btn ${mode === "single" ? "device-sim-panel__btn--active" : ""}`}
            onClick={() => setMode("single")}
          >
            <Square size={16} /> Single Device
          </button>
          <button 
            className={`device-sim-panel__btn ${mode === "multi" ? "device-sim-panel__btn--active" : ""}`}
            onClick={() => setMode("multi")}
          >
            <Columns size={16} /> Side-by-Side
          </button>
        </div>
      </div>
      
      {mode === "single" ? (
        <>
          <div className="device-sim-panel__section">
            <label className="device-sim-panel__label">Device Preset</label>
            <select 
              className="device-sim-panel__select" 
              value={value?.deviceName || "Custom"} 
              onChange={handlePresetChange}
            >
              {DEVICE_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name} ({preset.w}x{preset.h})
                </option>
              ))}
              <option value="Custom">Custom Dimensions</option>
            </select>
          </div>

          <div className="device-sim-panel__section device-sim-panel__row">
            <div className="device-sim-panel__col">
              <label className="device-sim-panel__label">Width (px)</label>
              <input 
                type="number" 
                className="device-sim-panel__input" 
                value={value?.deviceName === "Custom" ? customW : value?.width} 
                onChange={(e) => handleCustomChange("w", e.target.value)}
                onBlur={applyCustomDimensions}
                disabled={value?.deviceName !== "Custom"}
              />
            </div>
            <div className="device-sim-panel__col">
              <label className="device-sim-panel__label">Height (px)</label>
              <input 
                type="number" 
                className="device-sim-panel__input" 
                value={value?.deviceName === "Custom" ? customH : value?.height} 
                onChange={(e) => handleCustomChange("h", e.target.value)}
                onBlur={applyCustomDimensions}
                disabled={value?.deviceName !== "Custom"}
              />
            </div>
          </div>

          <div className="device-sim-panel__section">
            <label className="device-sim-panel__label">Orientation</label>
            <div className="device-sim-panel__btn-group">
              <button 
                className={`device-sim-panel__btn ${value?.orientation === "portrait" ? "device-sim-panel__btn--active" : ""}`}
                onClick={() => onChange({ ...value, orientation: "portrait" })}
              >
                <Smartphone size={16} /> Portrait
              </button>
              <button 
                className={`device-sim-panel__btn ${value?.orientation === "landscape" ? "device-sim-panel__btn--active" : ""}`}
                onClick={() => onChange({ ...value, orientation: "landscape" })}
              >
                <Tablet size={16} /> Landscape
              </button>
              <button 
                className="device-sim-panel__btn device-sim-panel__btn--icon"
                onClick={toggleOrientation}
                title="Swap Dimensions"
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>

          <div className="device-sim-panel__section">
            <label className="device-sim-panel__label">Zoom / Scale</label>
            <div className="device-sim-panel__row">
              <select 
                className="device-sim-panel__select" 
                value={value?.zoom || "fit"} 
                onChange={handleZoomChange}
                style={{ flex: 1 }}
              >
                <option value="fit">Fit to Window</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1">100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
              </select>
              <button 
                className="device-sim-panel__btn device-sim-panel__btn--icon"
                onClick={() => onChange({ ...value, zoom: "fit" })}
                title="Fit to Window"
              >
                <Maximize size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="device-sim-panel__section">
            <label className="device-sim-panel__label">Left Pane Device</label>
            <select 
              className="device-sim-panel__select" 
              value={multiDevices[0] || "iPhone 12"} 
              onChange={(e) => handleMultiDeviceChange(0, e.target.value)}
            >
              {DEVICE_PRESETS.map((preset) => (
                <option key={`left-${preset.name}`} value={preset.name}>
                  {preset.name} ({preset.w}x{preset.h})
                </option>
              ))}
            </select>
          </div>
          
          <div className="device-sim-panel__section">
            <label className="device-sim-panel__label">Right Pane Device</label>
            <select 
              className="device-sim-panel__select" 
              value={multiDevices[1] || "Desktop"} 
              onChange={(e) => handleMultiDeviceChange(1, e.target.value)}
            >
              {DEVICE_PRESETS.map((preset) => (
                <option key={`right-${preset.name}`} value={preset.name}>
                  {preset.name} ({preset.w}x{preset.h})
                </option>
              ))}
            </select>
          </div>
          
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>
            Side-by-side mode auto-scales both devices to fit proportionally in your window.
          </div>
        </>
      )}
    </div>
  );
}
