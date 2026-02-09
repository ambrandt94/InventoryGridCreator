import React, { useState, useEffect, useCallback } from 'react';

interface ResizableSidebarProps {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  children: React.ReactNode;
}

const ResizableSidebar: React.FC<ResizableSidebarProps> = ({
  initialWidth = 320,
  minWidth = 200,
  maxWidth = 600,
  children,
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        let newWidth = e.clientX;
        // Clamp width between min and max
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        setWidth(newWidth);
      }
    },
    [isResizing, minWidth, maxWidth]
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div
      className="bg-surface overflow-y-auto p-4 flex flex-col gap-6 shadow-2xl z-20 relative"
      style={{ width: `${width}px` }}
    >
      {children}
      <div
        className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-surface-600 transition-colors duration-100"
        onMouseDown={startResizing}
        style={{ zIndex: 100 }}
      />
    </div>
  );
};

export default ResizableSidebar;
