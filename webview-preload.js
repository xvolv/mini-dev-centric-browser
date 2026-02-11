const { ipcRenderer } = require('electron');

let pendingTimer = null;

const sendSelection = () => {
  const selection = window.getSelection?.();
  const text = selection ? selection.toString().trim() : '';

  if (!text || !selection || selection.rangeCount === 0) {
    ipcRenderer.sendToHost('selection-change', { text: '' });
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const payload = {
    text: text.slice(0, 4000),
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };

  ipcRenderer.sendToHost('selection-change', payload);
};

const scheduleSelection = () => {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(sendSelection, 80);
};

window.addEventListener('mouseup', scheduleSelection, true);
window.addEventListener('keyup', scheduleSelection, true);
window.addEventListener('selectionchange', scheduleSelection, true);
window.addEventListener('scroll', scheduleSelection, true);
