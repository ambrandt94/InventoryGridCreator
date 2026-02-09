import React, { useState, useEffect, useCallback, useRef } from 'react';
import ResizableSidebar from './ResizableSidebar'; // Import the ResizableSidebar component
import { 
  Save, Upload, Plus, 
  Trash2, Grid3X3, Box, Settings, LayoutGrid,
  FlipHorizontal, Sliders, Eye, Image as ImageIcon, Move,
  Pencil, Lock, MousePointer2, PaintBucket
}
 from 'lucide-react';

// --- Constants ---
const GAP = 2;

// --- Helper Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const hexToRgba = (hex, alpha) => {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return hex;
}

const rotateMatrix = (matrix) => {
  if (!matrix || matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const newMatrix = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      newMatrix[x][rows - 1 - y] = matrix[y][x];
    }
  }
  return newMatrix;
};

const rotateMatrixCCW = (matrix) => {
  return rotateMatrix(rotateMatrix(rotateMatrix(matrix)));
};

const flipMatrix = (matrix) => {
  return matrix.map(row => [...row].reverse());
};

const getItemOccupiedCells = (shapeMatrix, startX, startY) => {
  const cells = [];
  shapeMatrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 1) {
        cells.push({ x: startX + x, y: startY + y });
      }
    });
  });
  return cells;
};

const canPlaceItem = (container, itemShape, x, y, excludeInstanceId = null) => {
  const itemCells = getItemOccupiedCells(itemShape, x, y);
  for (let cell of itemCells) {
    if (
      cell.y < 0 || 
      cell.y >= container.shape.length || 
      cell.x < 0 || 
      cell.x >= container.shape[0].length ||
      container.shape[cell.y][cell.x] === 0 
    ) {
      return false;
    }
  }
  for (let instance of container.items) {
    if (instance.id === excludeInstanceId) continue;
    const otherCells = getItemOccupiedCells(instance.currentShape, instance.x, instance.y);
    const hasOverlap = itemCells.some(ic => 
      otherCells.some(oc => oc.x === ic.x && oc.y === ic.y)
    );
    if (hasOverlap) return false;
  }
  return true;
};

// Calculate the center cell of a shape (for mouse anchoring)
const getCenterCellOffset = (shape) => {
  const centerCol = Math.floor(shape[0].length / 2);
  const centerRow = Math.floor(shape.length / 2);
  return { x: centerCol, y: centerRow };
};

const loadFromLocalStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null || saved === undefined || saved === 'undefined') {
        return defaultValue;
    }
    return JSON.parse(saved);
  } catch (e) {
    console.error(`Error loading ${key} from localStorage:`, e);
    return defaultValue;
  }
};

// --- Components ---

const ShapeEditor = ({ onSave, initialData = null, type = 'item', onClose }) => {
  const [width, setWidth] = useState(initialData?.shape?.[0]?.length || 4);
  const [height, setHeight] = useState(initialData?.shape?.length || 4);
  const [matrix, setMatrix] = useState(initialData?.shape || Array(4).fill(Array(4).fill(1)));
  const [name, setName] = useState(initialData?.name || '');
  const [color, setColor] = useState(initialData?.color || '#6366f1');
  const [maxWeight, setMaxWeight] = useState(initialData?.maxWeight || 0);
  const [weight, setWeight] = useState(initialData?.weight || 0); // New state for weight
  
  // Image State
  const [image, setImage] = useState(initialData?.image || null);
  const [imgOffset, setImgOffset] = useState(initialData?.imageConfig ? { x: initialData.imageConfig.x, y: initialData.imageConfig.y } : { x: 0, y: 0 });
  const [imgScale, setImgScale] = useState(initialData?.imageConfig?.scale || 100);
  const [imgPanOffset, setImgPanOffset] = useState(initialData?.imageConfig?.panOffset || { x: 0, y: 0 }); // New pan offset state
  const [imgZoom, setImgZoom] = useState(initialData?.imageConfig?.zoom || 1); // New zoom state
  const [isDraggingImg, setIsDraggingImg] = useState(false); // For imgOffset adjustment
  const [isPanningView, setIsPanningView] = useState(false); // For imgPanOffset adjustment (viewport movement)
  const dragStart = useRef({ x: 0, y: 0 });

  const [mode, setMode] = useState('grid'); 

  // Editor constants
  const EDITOR_CELL = 30;
  const EDITOR_GAP = 4;

  useEffect(() => {
    if(initialData && width === initialData.shape[0].length && height === initialData.shape.length) return;
    setMatrix(Array(height).fill(null).map(() => Array(width).fill(1))); // Default all cells to active
  }, [width, height, type]);

  const toggleCell = (r, c) => {
    if (mode !== 'grid') return;
    const newM = matrix.map(row => [...row]);
    newM[r][c] = newM[r][c] === 1 ? 0 : 1;
    setMatrix(newM);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
          setImage(e.target.result);
          setMode('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const startDragImage = (e) => {
    if (mode !== 'image') return;
    e.preventDefault();
    if (e.shiftKey) {
      setIsPanningView(true);
      dragStart.current = { x: e.clientX - imgPanOffset.x, y: e.clientY - imgPanOffset.y };
    } else {
      setIsDraggingImg(true);
      dragStart.current = { x: e.clientX - imgOffset.x, y: e.clientY - imgOffset.y };
    }
  };

  const onDragImage = (e) => {
    if (!isDraggingImg && !isPanningView) return;

    if (isPanningView) {
      setImgPanOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    } else if (isDraggingImg) {
      let newY = e.clientY - dragStart.current.y;

      // Calculate vertical snapping
      const SNAP_THRESHOLD = 10; // pixels
      if (Math.abs(newY) < SNAP_THRESHOLD) { // if close to vertical center (0 offset)
        newY = 0; // Snap to center
      }

      setImgOffset({
        x: e.clientX - dragStart.current.x,
        y: newY
      });
    }
  };

  const stopDragImage = () => {
    setIsDraggingImg(false);
    setIsPanningView(false);
  };

  const handleZoom = (e) => {
    e.preventDefault();
    const zoomSpeed = 0.1;
    let newZoom = imgZoom;

    if (e.deltaY < 0) { // Zoom in
      newZoom += zoomSpeed;
    } else { // Zoom out
      newZoom -= zoomSpeed;
    }

    // Clamp zoom level
    newZoom = Math.max(0.5, Math.min(newZoom, 5)); 
    setImgZoom(newZoom);
  };

  const handleSave = () => {
    if (!name) return alert("Please name your creation");
    onSave({
      id: initialData?.id || generateId(),
      name,
      shape: matrix,
      type,
      ...(type === 'item' && { color, weight }), // also include weight for items
      ...(type === 'container' && { maxWeight }), // only include maxWeight for containers
      image,
      imageConfig: image ? { x: imgOffset.x, y: imgOffset.y, scale: imgScale, panOffset: imgPanOffset, zoom: imgZoom } : null
    });
    onClose();
  };

  return (
    <div 
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
        onMouseMove={onDragImage}
        onMouseUp={stopDragImage}
        onMouseLeave={stopDragImage}
    >
      <div className="bg-surface p-6 rounded-xl border border-surface-600 shadow-2xl w-[700px] max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <h2 className="font-heading text-xl font-bold text-on-background">
            {initialData ? 'Edit' : 'Create New'} {type === 'item' ? 'Item' : 'Container'}
            </h2>
            
            {type === 'item' && image && (
                <div className="flex bg-surface-900 rounded-lg p-1 border border-surface-700">
                    <button 
                        onClick={() => setMode('grid')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'grid' ? 'bg-primary text-on-background' : 'text-on-surface hover:text-on-background'}`}
                    >
                        <Grid3X3 size={14}/> Edit Grid
                    </button>
                    <button 
                        onClick={() => setMode('image')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'image' ? 'bg-primary text-on-background' : 'text-on-surface hover:text-on-background'}`}
                    >
                        <Move size={14}/> Move Image
                    </button>
                </div>
            )}
        </div>
        
        <div className="flex gap-6 mb-6">
            <div className="flex-1 bg-surface/50 p-8 rounded border border-surface-700/50 overflow-hidden select-none flex justify-center items-center relative min-h-[300px]">
                {/* Hitbox border visualization */}
                <div 
                    className="absolute border-2 border-dashed border-surface-600/30 pointer-events-none"
                    style={{
                        width: width * EDITOR_CELL + Math.max(0, width - 1) * EDITOR_GAP,
                        height: height * EDITOR_CELL + Math.max(0, height - 1) * EDITOR_GAP
                    }}
                />

                <div 
                    className={`relative z-10 grid ${mode === 'image' ? 'pointer-events-none opacity-50' : ''}`} 
                    style={{ 
                        gridTemplateColumns: `repeat(${width}, ${EDITOR_CELL}px)`,
                        gap: `${EDITOR_GAP}px`
                    }}
                >
                    {matrix.map((row, r) => row.map((cell, c) => (
                    <div 
                        key={`${r}-${c}`}
                        onClick={() => toggleCell(r, c)}
                        className={`w-[30px] h-[30px] border border-surface-600/50 cursor-pointer rounded-sm hover:ring-2 ring-on-background/50 transition-all z-20 ${
                                                cell === 1
                                                    ? (type === 'item' ? 'bg-primary-500 border-primary-400 border-2' : 'bg-surface-200 border-surface-400 border-2')
                                                    : 'bg-transparent opacity-30'                        }`}
                    />
                    )))
                    }
                </div>

                {image && (
                    <div 
                        className={`absolute z-0 ${mode === 'image' ? 'cursor-move' : 'pointer-events-none'}`}
                        style={{
                            left: '50%',
                            top: '50%',
                            transform: `translate(-50%, -50%) translate(${imgOffset.x}px, ${imgOffset.y}px)`, // imgOffset for grid alignment
                        }}
                        onMouseDown={startDragImage} // for drag to position
                        onWheel={handleZoom} // for zoom
                    >
                        <img 
                            src={image} 
                            alt="Item Asset" 
                            draggable={false}
                            style={{ 
                                width: `${imgScale * imgZoom}px`, // Apply zoom to image width
                                maxWidth: 'none',
                                opacity: mode === 'grid' ? 0.5 : 1,
                                transform: `translate(${imgPanOffset.x}px, ${imgPanOffset.y}px)` // Apply pan
                            }}
                        />
                        {mode === 'image' && (
                            <div className="absolute inset-0 border border-primary-400 opacity-50 pointer-events-none"></div>
                        )}
                    </div>
                )}
                
                <div className="absolute inset-0 pointer-events-none opacity-10" style={{backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
            </div>

            <div className="w-64 space-y-5">
                <div>
                    <label className="text-xs text-on-surface block mb-1">Dimensions</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-on-surface">W</span>
                            <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="w-full bg-background text-on-background pl-6 pr-2 py-1.5 rounded border border-surface-700 focus:border-primary-500 outline-none text-sm" min="1" max="10"/>
                        </div>
                        <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-on-surface">H</span>
                            <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} className="w-full bg-background text-on-background pl-6 pr-2 py-1.5 rounded border border-surface-700 focus:border-primary-500 outline-none text-sm" min="1" max="10"/>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-xs text-on-surface block mb-1">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-background text-on-background p-2 rounded border border-surface-700 focus:border-primary-500 outline-none text-sm" placeholder="Ex: Health Potion"/>
                </div>

                {type === 'item' && (
                <div>
                    <label className="text-xs text-on-surface block mb-1">Color</label>
                    <div className="flex items-center gap-2 mb-2"> {/* New row for color picker */}
                        <input 
                            type="color" 
                            value={color} 
                            onChange={e => setColor(e.target.value)}
                            className="w-8 h-8 rounded-md cursor-pointer border-none bg-transparent"
                            title="Pick a custom color"
                        />
                        <span className="text-sm text-on-surface">{color}</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap"> {/* Existing color palette */}
                    {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#94a3b8'].map(c => (
                        <button 
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-on-background scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                        />
                    ))}
                    </div>
                </div>
                )}
                {type === 'container' && (
                    <div>
                        <label className="text-xs text-on-surface block mb-1">Max Weight (lbs)</label>
                        <input 
                            type="number" 
                            step="0.1" 
                            value={maxWeight} 
                            onChange={e => setMaxWeight(Number(e.target.value))} 
                            className="w-full bg-background text-on-background p-2 rounded border border-surface-700 focus:border-primary-500 outline-none text-sm" 
                            placeholder="Ex: 10.0"
                        />
                    </div>
                )}
                {type === 'item' && (
                    <div className="pt-4 border-t border-surface-700">
                        <label className="text-xs font-bold text-on-surface flex items-center gap-2 mb-2"><ImageIcon size={14}/> Image Asset</label>
                        
                        {!image ? (
                            <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-surface-700 rounded hover:border-primary-500 hover:bg-surface-800 transition-colors cursor-pointer text-on-surface text-[10px]">
                                <Upload size={16} className="mb-1"/>
                                <span>Click to Upload</span>
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </label>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs text-on-surface mb-1">
                                        <span>Scale</span>
                                        <span>{imgScale}px</span>
                                    </div>
                                    <input 
                                        type="range" min="20" max="400" 
                                        value={imgScale} 
                                        onChange={e => setImgScale(Number(e.target.value))}
                                        className="w-full accent-primary h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer"
                                        disabled={mode !== 'image'}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <label className="flex-1 text-center py-1.5 bg-surface-800 border border-surface-700 rounded cursor-pointer hover:bg-surface-700 text-[10px] text-on-surface">
                                        Change
                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    </label>
                                    <button onClick={() => setImage(null)} className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>



        <div className="flex justify-end gap-2 pt-4 border-t border-surface-700 mt-auto">

          <button onClick={onClose} className="px-4 py-2 text-on-surface hover:bg-surface-700 rounded transition-colors">Cancel</button>

          <button onClick={handleSave} className="px-4 py-2 bg-primary text-on-background hover:bg-primary-500 rounded font-bold transition-colors shadow-lg shadow-primary/20">Save Asset</button>

        </div>

      </div>

    </div>

  );

};

// --- Main Application ---


// --- Initial Default Data ---
const INITIAL_ITEM_DEFS = [
    { id: 'i1', name: 'Long Sword', type: 'item', color: '#ef4444', shape: [[1], [1], [1]], weight: 3.5 },
    { id: 'i2', name: 'Wooden Shield', type: 'item', color: '#3b82f6', shape: [[1, 1], [1, 1]], weight: 2.0 },
    { id: 'i3', name: 'Healing Potion', type: 'item', color: '#ec4899', shape: [[1]], weight: 0.2 },
    { id: 'i4', name: 'Leather Armor', type: 'item', color: '#8b5c2e', shape: [[1, 1], [1, 1], [1, 1]], weight: 5.0 },
    { id: 'i5', name: 'Bow and Arrow', type: 'item', color: '#22c55e', shape: [[1, 1, 1, 1]], weight: 1.5 },
    { id: 'i6', name: 'Spellbook', type: 'item', color: '#a855f7', shape: [[1, 1], [1, 1]], weight: 1.0 },
    { id: 'i7', name: 'Gold Coins', type: 'item', color: '#eab308', shape: [[1]], weight: 0.1 },
    { id: 'i8', name: 'Torch', type: 'item', color: '#f97316', shape: [[1], [1]], weight: 0.5 },
    { id: 'i9', name: 'Rope', type: 'item', color: '#94a3b8', shape: [[1], [1], [1]], weight: 0.8 },
];

const INITIAL_CONTAINER_DEFS = [
    { id: 'c1', name: "Adventurer's Backpack", type: 'container', shape: Array(6).fill(Array(8).fill(1)), maxWeight: 10.0 }, // 6x8
    { id: 'c2', name: "Alchemist's Satchel", type: 'container', shape: Array(4).fill(Array(4).fill(1)), maxWeight: 2.0 }, // 4x4
    { id: 'c3', name: "Treasure Chest", type: 'container', shape: Array(5).fill(Array(6).fill(1)), maxWeight: 50.0 }, // 5x6
    { id: 'c4', name: "Quiver", type: 'container', shape: Array(2).fill(Array(5).fill(1)), maxWeight: 5.0 }, // 2x5
    { id: 'c5', name: "Scroll Case", type: 'container', shape: Array(1).fill(Array(3).fill(1)), maxWeight: 0.5 }, // 1x3
    { id: 'c6', name: "Potion Belt", type: 'container', shape: Array(1).fill(Array(4).fill(1)), maxWeight: 1.0 }, // 1x4
];

const INITIAL_ACTIVE_CONTAINERS = [
    { instanceId: 'ac1', defId: 'c1', items: [] } // Default if nothing in localStorage
];

export default function App() {
  const [itemDefs, setItemDefs] = useState(() => loadFromLocalStorage('gridForge_itemDefs', INITIAL_ITEM_DEFS));

  const [containerDefs, setContainerDefs] = useState(() => loadFromLocalStorage('gridForge_containerDefs', INITIAL_CONTAINER_DEFS));

  const [activeContainers, setActiveContainers] = useState(() => loadFromLocalStorage('gridForge_activeContainers', INITIAL_ACTIVE_CONTAINERS));
  const [dragState, setDragState] = useState(null); 
  const [hoverTarget, setHoverTarget] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [editorOpen, setEditorOpen] = useState(null); 
  const [searchTerm, setSearchTerm] = useState(''); // New state for search functionality
  
  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('gridForge_sort');
      return saved ? JSON.parse(saved) : {
        allowRotate: true,
        allowFlip: true,
        startCorner: 'TL'
      };
    } catch (e) {
      return { allowRotate: true, allowFlip: true, startCorner: 'TL' };
    }
  });

  const [visualSettings, setVisualSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('gridForge_visualSettings');
      const defaults = {
        thickness: 2,
        color: '#000000',
        opacity: 0.5,
        gridScale: 40,
        imageFillColor: '#6366f1',
        imageFillOpacity: 0.0 // Default off
      };
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (e) {
      return { thickness: 2, color: '#000000', opacity: 0.5, gridScale: 40, imageFillColor: '#6366f1', imageFillOpacity: 0.0 };
    }
  });

  // Auto-save settings
  useEffect(() => {
    localStorage.setItem('gridForge_visualSettings', JSON.stringify(visualSettings));
  }, [visualSettings]);

  useEffect(() => {
    localStorage.setItem('gridForge_sortConfig', JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    localStorage.setItem('gridForge_itemDefs', JSON.stringify(itemDefs));
  }, [itemDefs]);

  useEffect(() => {
    localStorage.setItem('gridForge_containerDefs', JSON.stringify(containerDefs));
  }, [containerDefs]);

  useEffect(() => {
    localStorage.setItem('gridForge_activeContainers', JSON.stringify(activeContainers));
  }, [activeContainers]);

  const deleteItemDef = (id) => {
    if(!window.confirm("Delete this item? It will be removed from all containers.")) return;
    setItemDefs(prev => prev.filter(i => i.id !== id));
    setActiveContainers(prev => prev.map(c => ({
      ...c,
      items: c.items.filter(i => i.defId !== id)
    })));
  };

  const deleteContainerDef = (id) => {
    if(!window.confirm("Delete this container layout? All active containers of this type will be removed.")) return;
    setContainerDefs(prev => prev.filter(c => c.id !== id));
    setActiveContainers(prev => prev.filter(c => c.defId !== id));
  };

  const handleEditItem = (def) => {
      setEditorOpen({ type: 'item', initialData: def });
  };

  const handleEditContainer = (def) => {
      setEditorOpen({ type: 'container', initialData: def });
  };

  const handleSaveEditor = (newItem) => {
      if (newItem.type === 'item') {
          const exists = itemDefs.find(i => i.id === newItem.id);
          if (exists) {
              setItemDefs(itemDefs.map(i => i.id === newItem.id ? newItem : i));
          } else {
              setItemDefs([...itemDefs, newItem]);
          }
      } else {
          const exists = containerDefs.find(c => c.id === newItem.id);
          if (exists) {
              setContainerDefs(containerDefs.map(c => c.id === newItem.id ? newItem : c));
          } else {
              setContainerDefs([...containerDefs, newItem]);
          }
      }
  };

  const handleMouseDown = (e, itemInstance, containerId, isPaletteItem = false) => {
    if (e.target.closest('button')) return;

    e.preventDefault();
    e.stopPropagation();

    const item = isPaletteItem 
      ? { ...itemInstance, instanceId: generateId(), currentShape: itemInstance.shape, rotation: 0, defId: itemInstance.id }
      : itemInstance;

    // Use null offsets to signal center-based dragging
    setDragState({
      item,
      sourceContainerId: containerId,
      originalX: isPaletteItem ? -1 : item.x,
      originalY: isPaletteItem ? -1 : item.y,
      offsetX: 0, // Ignored in center mode logic
      offsetY: 0,
      isPalette: isPaletteItem
    });

    if (!isPaletteItem) {
      setActiveContainers(prev => prev.map(c => {
        if (c.instanceId === containerId) {
          return { ...c, items: c.items.filter(i => i.instanceId !== item.instanceId) };
        }
        return c;
      }));
    }
  };

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    if (dragState) {
        // Find container under cursor
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const containerEl = elements.find(el => el.hasAttribute('data-drop-container-id'));

        if (containerEl) {
            const containerId = containerEl.getAttribute('data-drop-container-id');
            const rect = containerEl.getBoundingClientRect();
            const relX = e.clientX - rect.left;
            const relY = e.clientY - rect.top;
            
            // Calculate grid coords
            const rawX = Math.floor(relX / (visualSettings.gridScale + GAP));
            const rawY = Math.floor(relY / (visualSettings.gridScale + GAP));

            setHoverTarget(prev => {
                if (prev && prev.containerId === containerId && prev.x === rawX && prev.y === rawY) return prev;
                return { containerId, x: rawX, y: rawY };
            });
        } else {
            setHoverTarget(null);
        }
    }
  }, [dragState, visualSettings.gridScale]);

  const handleRotation = useCallback((direction) => {
    if (!dragState) return;
    
    setDragState(prev => {
      const newShape = direction === 'cw' 
        ? rotateMatrix(prev.item.currentShape) 
        : rotateMatrixCCW(prev.item.currentShape);
      
      const newRotation = (prev.item.rotation + (direction === 'cw' ? 1 : 3)) % 4;

      return {
        ...prev,
        item: {
          ...prev.item,
          currentShape: newShape,
          rotation: newRotation
        }
      };
    });
  }, [dragState]);

  const handleFlip = useCallback(() => {
    if (!dragState) return;
    
    setDragState(prev => {
      const newShape = flipMatrix(prev.item.currentShape);
      return {
        ...prev,
        item: {
          ...prev.item,
          currentShape: newShape
        }
      };
    });
  }, [dragState]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'e') handleRotation('cw');
      if (key === 'q') handleRotation('ccw');
      if (key === 'w') handleFlip();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleRotation, handleFlip, handleMouseMove]);

  const handleMouseUp = (e) => {
    if (!dragState) return;

    let placed = false;

    if (hoverTarget) {
      const { containerId, x: mouseGridX, y: mouseGridY } = hoverTarget;
      
      const containerIndex = activeContainers.findIndex(c => c.instanceId === containerId);
      if (containerIndex !== -1) {
        const container = activeContainers[containerIndex];
        const containerDef = containerDefs.find(d => d.id === container.defId);
        
        // Use center cell offset logic
        const centerOffset = getCenterCellOffset(dragState.item.currentShape);
        const targetX = mouseGridX - centerOffset.x;
        const targetY = mouseGridY - centerOffset.y;

        const containerObj = { ...container, shape: containerDef.shape };

        if (canPlaceItem(containerObj, dragState.item.currentShape, targetX, targetY)) {
          const newItem = { ...dragState.item, x: targetX, y: targetY };
          
          setActiveContainers(prev => {
            const next = [...prev];
            next[containerIndex] = {
              ...container,
              items: [...container.items, newItem]
            };
            return next;
          });
          placed = true;
        }
      }
    }

    if (!placed && !dragState.isPalette) {
      setActiveContainers(prev => prev.map(c => {
        if (c.instanceId === dragState.sourceContainerId) {
          return {
            ...c,
            items: [...c.items, { 
              ...dragState.item, 
              x: dragState.originalX, 
              y: dragState.originalY 
            }]
          };
        }
        return c;
      }));
    }

    setDragState(null);
    setHoverTarget(null);
  };

  const autoSort = (containerInstanceId) => {
    const containerIdx = activeContainers.findIndex(c => c.instanceId === containerInstanceId);
    if (containerIdx === -1) return;

    const container = activeContainers[containerIdx];
    const containerDef = containerDefs.find(d => d.id === container.defId);
    
    let itemsToSort = [...container.items];
    itemsToSort.sort((a, b) => {
      const sizeA = a.currentShape.flat().filter(x => x === 1).length;
      const sizeB = b.currentShape.flat().filter(x => x === 1).length;
      return sizeB - sizeA;
    });

    const newItems = [];
    const occupiedMap = containerDef.shape.map(row => [...row].fill(0)); 

    const tryPlace = (item, x, y, shape) => {
      const itemCells = getItemOccupiedCells(shape, x, y);
      for (let cell of itemCells) {
        if (
          cell.y < 0 || cell.y >= containerDef.shape.length ||
          cell.x < 0 || cell.x >= containerDef.shape[0].length ||
          containerDef.shape[cell.y][cell.x] === 0 || 
          occupiedMap[cell.y][cell.x] === 1 
        ) return false;
      }
      return true;
    };

    const markMap = (x, y, shape) => {
      const itemCells = getItemOccupiedCells(shape, x, y);
      itemCells.forEach(cell => {
        occupiedMap[cell.y][cell.x] = 1;
      });
    };

    const rows = containerDef.shape.length;
    const cols = containerDef.shape[0].length;
    let coords = [];
    for(let y=0; y<rows; y++) {
      for(let x=0; x<cols; x++) {
        coords.push({x, y});
      }
    }

    if (sortConfig.startCorner === 'TR') {
      coords.sort((a, b) => (a.y - b.y) || (b.x - a.x));
    } else if (sortConfig.startCorner === 'BL') {
      coords.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    } else if (sortConfig.startCorner === 'BR') {
      coords.sort((a, b) => (b.y - a.y) || (b.x - a.x));
    }

    const flips = sortConfig.allowFlip ? [false, true] : [false];
    const rotations = sortConfig.allowRotate ? [0, 1, 2, 3] : [0];

    for (let item of itemsToSort) {
      let placed = false;
      
      const def = itemDefs.find(d => d.id === item.defId);
      if(!def) continue; 

      for (let f of flips) {
          if (placed) break;
          for (let r of rotations) {
            if (placed) break;

            let testShape = def.shape;
            if (f) testShape = flipMatrix(testShape);
            for(let i=0; i<r; i++) testShape = rotateMatrix(testShape);

            for (let coord of coords) {
              if (tryPlace(item, coord.x, coord.y, testShape)) {
                newItems.push({ ...item, x: coord.x, y: coord.y, currentShape: testShape, rotation: r });
                markMap(coord.x, coord.y, testShape);
                placed = true;
                break;
              }
            }
        }
      }
    }

    setActiveContainers(prev => {
      const next = [...prev];
      next[containerIdx] = { ...container, items: newItems };
      return next;
    });
  };

  const renderGrid = (containerInstance, containerDef) => {
    const scale = visualSettings.gridScale;
    const gridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${containerDef.shape[0].length}, ${scale}px)`,
      gap: `${GAP}px`
    };

    let ghostCells = [];
    let isValidPlacement = false;

        if (dragState && hoverTarget && hoverTarget.containerId === containerInstance.instanceId) {
          const centerOffset = getCenterCellOffset(dragState.item.currentShape);
          const targetX = hoverTarget.x - centerOffset.x;
          const targetY = hoverTarget.y - centerOffset.y;
    
          ghostCells = getItemOccupiedCells(dragState.item.currentShape, targetX, targetY);
          isValidPlacement = canPlaceItem(
            { ...containerInstance, shape: containerDef.shape },
            dragState.item.currentShape,
            targetX,
            targetY
          );
        }
    
        const WeightDisplay = () => {
            const currentWeight = containerInstance.items.reduce((sum, item) => {
                const def = itemDefs.find(d => d.id === item.defId);
                return sum + (def?.weight || 0);
            }, 0);
            const displayMaxWeight = containerDef.maxWeight ?? 0;
            const comparisonMaxWeight = containerDef.maxWeight === undefined || containerDef.maxWeight === null ? Infinity : containerDef.maxWeight;
    
            const isOverweight = currentWeight > comparisonMaxWeight;
            const overweightAmount = (currentWeight - comparisonMaxWeight).toFixed(1);
    
            const weightPercentage = displayMaxWeight === 0 ? 0 : (currentWeight / displayMaxWeight) * 100;
    
            return (
                <div className="flex flex-col items-end">
                    <span className={`text-sm font-semibold ${isOverweight ? 'text-red-400' : 'text-on-background'}`}>
                        {currentWeight.toFixed(1)} / {displayMaxWeight.toFixed(1)} lbs
                    </span>
                    {isOverweight && (
                        <span className="text-red-400 text-xs font-medium -mt-1">
                            Overweight by {overweightAmount} lbs
                        </span>
                    )}
                    <div className="w-full h-2 bg-surface-700 rounded-full mt-1 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${isOverweight ? 'bg-red-500' : 'bg-primary-500'}`}
                            style={{ width: `${Math.min(weightPercentage, 100)}%` }} // Cap at 100% visually
                        ></div>
                    </div>
                </div>
            );
        };
    return (
      <div 
        onMouseLeave={() => setHoverTarget(null)}
        className="relative bg-surface/50 p-3 rounded-xl border border-surface-700 shadow-inner inline-block backdrop-blur-sm"
      >
                <div className="flex justify-between items-center mb-3 text-on-surface text-xs uppercase tracking-wider font-bold">
                    <span className="flex items-center gap-2"><Box size={14} className="text-primary-400"/> {containerDef.name}</span>
                    <div className="flex gap-1 bg-surface-800 rounded p-0.5">
                        <button title="Auto Sort" onClick={() => autoSort(containerInstance.instanceId)} className="p-1 hover:bg-primary hover:text-on-background rounded transition-colors text-on-surface"><LayoutGrid size={14} /></button>
                        <div className="w-px bg-surface-700 mx-0.5"></div>
                        <button title="Delete Container" onClick={() => setActiveContainers(prev => prev.filter(c => c.instanceId !== containerInstance.instanceId))} className="p-1 hover:bg-red-500 hover:text-on-background rounded transition-colors text-on-surface"><Trash2 size={14} /></button>
                    </div>
                </div>
        
                {/* This div wraps the grid and carries the ID for hover detection */}
                <div
                    style={gridStyle}
                    className="relative"
                    data-drop-container-id={containerInstance.instanceId}
                >
        
                  {containerDef.shape.map((row, y) => (
                    row.map((cell, x) => {
                      const isGhost = ghostCells.some(g => g.x === x && g.y === y);
        
                      return (
                        <div
                          key={`cell-${x}-${y}`}
                                            className={`
                                              rounded transition-colors duration-75 z-10
                                              ${isGhost
                                                  ? `opacity-100 ${isValidPlacement ? 'bg-emerald-500/30 border-emerald-400' : 'bg-red-500/30 border-red-400'}` // Reduced opacity for ghost cells
                                                  : cell === 1
                                                      ? `bg-surface-800/70 border border-surface-700/50 ${dragState ? 'hover:bg-surface-700 hover:border-surface-500' : ''}` // Reduced opacity for normal cells
                                                      : 'opacity-0'
                                              }
                                            `}                  style={{ width: scale, height: scale }}
                        />
                      );
                    })
                  ))}
        
                  {containerInstance.items.map(item => {
                     const top = item.y * (scale + GAP);
                     const left = item.x * (scale + GAP);
                     const width = item.currentShape[0].length * scale + (item.currentShape[0].length - 1) * GAP;
                     const height = item.currentShape.length * scale + (item.currentShape.length - 1) * GAP;
        
                     return (
                       <div
                         key={item.instanceId}
                         onMouseDown={(e) => handleMouseDown(e, item, containerInstance.instanceId)}
                         className="absolute z-10 transition-filter pointer-events-none"
                         style={{ top, left, width, height }}
                       >
                         <ItemVisual item={item} visualSettings={visualSettings} isInteractive={true} />
                       </div>
                     );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-surface-700/50">
                    {(() => {
                        const currentWeight = containerInstance.items.reduce((sum, item) => {
                            const def = itemDefs.find(d => d.id === item.defId);
                            return sum + (def?.weight || 0);
                        }, 0);
                        const displayMaxWeight = containerDef.maxWeight ?? 0;
                        const comparisonMaxWeight = containerDef.maxWeight === undefined || containerDef.maxWeight === null ? Infinity : containerDef.maxWeight;
        
                        const isOverweight = currentWeight > comparisonMaxWeight;
                        const overweightAmount = (currentWeight - comparisonMaxWeight).toFixed(1);
        
                        const weightPercentage = displayMaxWeight === 0 ? 0 : (currentWeight / displayMaxWeight) * 100;
        
                        return (
                            <div className="flex flex-col items-end">
                                <span className={`text-sm font-semibold ${isOverweight ? 'text-red-400' : 'text-on-background'}`}>
                                    {currentWeight.toFixed(1)} / {displayMaxWeight.toFixed(1)} lbs
                                </span>
                                {isOverweight && (
                                    <span className="text-red-400 text-xs font-medium -mt-1">
                                        Overweight by {overweightAmount} lbs
                                    </span>
                                )}
                                <div className="w-full h-2 bg-surface-700 rounded-full mt-1 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ${isOverweight ? 'bg-red-500' : 'bg-primary-500'}`}
                                        style={{ width: `${Math.min(weightPercentage, 100)}%` }} // Cap at 100% visually
                                    ></div>
                                </div>
                            </div>
                        );
                    })()}
                </div>      </div>
    );
  };

  const ItemVisual = ({ item, visualSettings = { thickness: 3, color: '#000', opacity: 1, gridScale: 40, imageFillColor: '#6366f1', imageFillOpacity: 0.0 }, isInteractive = false }) => {
    const def = itemDefs.find(d => d.id === item.defId);
    if (!def) return null;
    const shape = item.currentShape;
    const borderColor = hexToRgba(visualSettings.color, visualSettings.opacity);
    const borderStyle = `${visualSettings.thickness}px solid ${borderColor}`;

    // --- Image Rendering Logic ---
    const EDITOR_CELL_SIZE = 30; // Matches ShapeEditor cell size
    const scaleRatio = visualSettings.gridScale / EDITOR_CELL_SIZE;

    if (def.image && def.imageConfig) {
        const rotationDeg = (item.rotation || 0) * 90;
        
        return (
            <div className="w-full h-full relative group overflow-hidden">
                 {/* Background Fill Layer (Behind Image) */}
                 <div 
                    className="absolute inset-0 z-0"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`,
                        gridTemplateRows: `repeat(${shape.length}, 1fr)`,
                        gap: '0px'
                    }}
                 >
                    {shape.map((row, y) => row.map((cell, x) => (
                        cell === 1 ? <div key={`bg-${x}-${y}`} style={{backgroundColor: hexToRgba(visualSettings.imageFillColor, visualSettings.imageFillOpacity)}} /> : <div key={`bg-${x}-${y}`} />
                    )))}
                 </div>

                 {/* Image Layer */}
                 <div 
                    className="absolute z-0 pointer-events-none"
                    style={{
                        left: '50%',
                        top: '50%',
                        width: '0px', height: '0px',
                        transform: `rotate(${rotationDeg}deg)`
                    }}
                 >
                     <div 
                        className="absolute"
                        style={{
                            left: def.imageConfig.x * scaleRatio, 
                            top: def.imageConfig.y * scaleRatio,
                            width: def.imageConfig.scale * scaleRatio, 
                            transform: 'translate(-50%, -50%)'
                        }}
                     >
                         <img src={def.image} className="w-full h-auto block" draggable={false} />
                     </div>
                 </div>

                 {/* Render Grid Borders on top of Image */}
                 <div 
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`,
                        gridTemplateRows: `repeat(${shape.length}, 1fr)`,
                        gap: '0px',
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        zIndex: 10
                    }}
                 >
                    {shape.map((row, y) => 
                        row.map((cell, x) => {
                        if (cell !== 1) return <div key={`${x}-${y}`} />;
                        
                        const hasTop = y > 0 && shape[y-1][x] === 1;
                        const hasBottom = y < shape.length - 1 && shape[y+1][x] === 1;
                        const hasLeft = x > 0 && shape[y][x-1] === 1;
                        const hasRight = x < shape[0].length - 1 && shape[y][x+1] === 1;

                        return (
                            <div 
                                key={`${x}-${y}`} 
                                className={`w-full h-full ${isInteractive ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : ''}`}
                                style={{
                                    borderTop: !hasTop ? borderStyle : 'none',
                                    borderBottom: !hasBottom ? borderStyle : 'none',
                                    borderLeft: !hasLeft ? borderStyle : 'none',
                                    borderRight: !hasRight ? borderStyle : 'none',
                                }}
                            />
                        );
                        })
                    )}
                 </div>
            </div>
        );
    }

    // --- Standard Color Rendering ---
    return (
      <div className="w-full h-full relative overflow-hidden">
        <div 
           style={{
             display: 'grid',
             gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`,
             gridTemplateRows: `repeat(${shape.length}, 1fr)`,
             gap: '0px', // Continuous look
             width: '100%',
             height: '100%'
           }}
        >
          {shape.map((row, y) => 
            row.map((cell, x) => {
              if (cell !== 1) return <div key={`${x}-${y}`} className="opacity-0"></div>;

              // Adjacency checks
              const hasTop = y > 0 && shape[y-1][x] === 1;
              const hasBottom = y < shape.length - 1 && shape[y+1][x] === 1;
              const hasLeft = x > 0 && shape[y][x-1] === 1;
              const hasRight = x < shape[0].length - 1 && shape[y][x+1] === 1;

              // Corner radius
              const radius = '4px'; 
              const tl = !hasTop && !hasLeft ? radius : '0';
              const tr = !hasTop && !hasRight ? radius : '0';
              const bl = !hasBottom && !hasLeft ? radius : '0';
              const br = !hasBottom && !hasRight ? radius : '0';

              return (
                <div key={`${x}-${y}`} className={`relative h-full w-full ${isInteractive ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : ''}`}>
                  <div 
                    className="w-full h-full relative overflow-hidden transition-colors box-border"
                    style={{ 
                        backgroundColor: def.color,
                        borderTop: !hasTop ? borderStyle : 'none',
                        borderBottom: !hasBottom ? borderStyle : 'none',
                        borderLeft: !hasLeft ? borderStyle : 'none',
                        borderRight: !hasRight ? borderStyle : 'none',
                        borderTopLeftRadius: tl,
                        borderTopRightRadius: tr,
                        borderBottomLeftRadius: bl,
                        borderBottomRightRadius: br,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/10 pointer-events-none"></div>
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            borderTop: !hasTop ? '1px solid rgba(255,255,255,0.4)' : 'none',
                            borderLeft: !hasLeft ? '1px solid rgba(255,255,255,0.4)' : 'none',
                            borderBottom: !hasBottom ? '1px solid rgba(0,0,0,0.2)' : 'none',
                            borderRight: !hasRight ? '1px solid rgba(0,0,0,0.2)' : 'none',
                            borderTopLeftRadius: tl,
                            borderTopRightRadius: tr,
                            borderBottomLeftRadius: bl,
                            borderBottomRightRadius: br,
                        }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const saveData = () => {
    const data = { itemDefs, containerDefs, activeContainers, sortConfig, visualSettings };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = "inventory-layout.json";
    link.href = url;
    link.click();
  };

  const loadData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if(data.itemDefs) {
              setItemDefs(data.itemDefs);
              localStorage.setItem('gridForge_itemDefs', JSON.stringify(data.itemDefs));
            }
            if(data.containerDefs) {
              setContainerDefs(data.containerDefs);
              localStorage.setItem('gridForge_containerDefs', JSON.stringify(data.containerDefs));
            }
            if(data.activeContainers) {
              setActiveContainers(data.activeContainers);
              localStorage.setItem('gridForge_activeContainers', JSON.stringify(data.activeContainers));
            }
            if(data.sortConfig) {
              setSortConfig(data.sortConfig);
              localStorage.setItem('gridForge_sortConfig', JSON.stringify(data.sortConfig));
            }
            if(data.visualSettings) {
              setVisualSettings(data.visualSettings);
              localStorage.setItem('gridForge_visualSettings', JSON.stringify(data.visualSettings));
            }
        } catch (err) {
            alert("Invalid save file");
        }
    };
    reader.readAsText(file);
  };

  const resetData = () => {
    if (!window.confirm("Are you sure you want to reset all data to default? This cannot be undone.")) return;

    setItemDefs(INITIAL_ITEM_DEFS);
    setContainerDefs(INITIAL_CONTAINER_DEFS);
    setActiveContainers(INITIAL_ACTIVE_CONTAINERS);

    localStorage.removeItem('gridForge_itemDefs');
    localStorage.removeItem('gridForge_containerDefs');
    localStorage.removeItem('gridForge_activeContainers');
    localStorage.removeItem('gridForge_sortConfig'); // Also reset sort/visual settings
    localStorage.removeItem('gridForge_visualSettings');

    alert("Data has been reset to defaults.");
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body selection:bg-primary/30 flex flex-col" onMouseUp={handleMouseUp}>
      
      <div className="h-16 border-b border-surface/50 flex items-center px-6 justify-between bg-surface/80 backdrop-blur-md sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg shadow-lg shadow-primary/20">
             <Box size={20} className="text-white"/>
          </div>
          <h1 className="font-heading font-bold text-lg tracking-tight">Grid<span className="text-primary-400">Forge</span></h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-surface rounded-lg p-1 gap-1 border border-surface/50">
             <button title="Create Item" onClick={() => setEditorOpen({type: 'item', initialData: null})} className="px-3 py-1.5 hover:bg-surface-700 hover:text-on-background text-on-surface rounded-md text-sm flex items-center gap-2 transition-all"><Plus size={14}/> Item</button>
             <button title="Create Container" onClick={() => setEditorOpen({type: 'container', initialData: null})} className="px-3 py-1.5 hover:bg-surface-700 hover:text-on-background text-on-surface rounded-md text-sm flex items-center gap-2 transition-all"><Plus size={14}/> Container</button>
          </div>
          
          <div className="h-6 w-px bg-surface-800"></div>

          <button onClick={saveData} className="flex items-center gap-2 text-sm hover:text-on-background text-on-surface transition-colors bg-surface/50 hover:bg-surface px-3 py-1.5 rounded-md border border-transparent hover:border-surface-700">
            <Save size={16}/> Save
          </button>
          <label className="flex items-center gap-2 text-sm hover:text-on-background text-on-surface transition-colors bg-surface/50 hover:bg-surface px-3 py-1.5 rounded-md border border-transparent hover:border-surface-700 cursor-pointer">
            <Upload size={16}/> Load
            <input type="file" className="hidden" onChange={loadData} accept=".json"/>
          </label>
          <button onClick={resetData} className="flex items-center gap-2 text-sm hover:text-on-background text-on-surface transition-colors bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-md border border-red-500/40">
            <Trash2 size={16}/> Reset
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        <div className="w-80 border-r border-surface/50 bg-surface overflow-y-auto p-4 flex flex-col gap-6 shadow-2xl z-20">
            
            <div className="p-4 bg-surface/50 rounded-xl border border-surface/50">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-on-surface mb-3 tracking-wider">
                    <Eye size={14} /> Visual Settings
                </div>
                <div className="space-y-6">
                     <div>
                        <div className="flex justify-between mb-1">
                            <span className="text-xs text-on-surface">Grid Scale</span>
                            <span className="text-xs text-on-surface">{visualSettings.gridScale}px</span>
                        </div>
                        <input 
                            type="range" min="20" max="80" step="2" 
                            value={visualSettings.gridScale} 
                            onChange={e => setVisualSettings({...visualSettings, gridScale: Number(e.target.value)})}
                            className="w-full accent-primary h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer"
                        />
                     </div>
                     
                     {/* Border Settings */}
                     <div>
                        <span className="text-xs font-semibold text-on-surface block mb-2">Border</span>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-[10px] text-on-surface">Thickness</span>
                                    <span className="text-[10px] text-on-surface">{visualSettings.thickness}px</span>
                                </div>
                                <input 
                                    type="range" min="0" max="8" step="1" 
                                    value={visualSettings.thickness} 
                                    onChange={e => setVisualSettings({...visualSettings, thickness: Number(e.target.value)})}
                                    className="w-full accent-primary h-1.5 bg-surface-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-[10px] text-on-surface">Opacity</span>
                                    <span className="text-[10px] text-on-surface">{Math.round(visualSettings.opacity * 100)}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={visualSettings.opacity} 
                                    onChange={e => setVisualSettings({...visualSettings, opacity: Number(e.target.value)})}
                                    className="w-full accent-primary h-1.5 bg-surface-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-on-surface">Color</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-on-surface">{visualSettings.color}</span>
                                    <input 
                                        type="color" 
                                        value={visualSettings.color} 
                                        onChange={e => setVisualSettings({...visualSettings, color: e.target.value})}
                                        className="w-5 h-5 rounded cursor-pointer border-none bg-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                     </div>

                     {/* Image Fill Settings */}
                     <div>
                        <span className="text-xs font-semibold text-on-surface block mb-2 flex items-center gap-2"><PaintBucket size={10}/> Image Background Fill</span>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-[10px] text-on-surface">Fill Opacity</span>
                                    <span className="text-[10px] text-on-surface">{Math.round(visualSettings.imageFillOpacity * 100)}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={visualSettings.imageFillOpacity} 
                                    onChange={e => setVisualSettings({...visualSettings, imageFillOpacity: Number(e.target.value)})}
                                    className="w-full accent-primary h-1.5 bg-surface-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-on-surface">Fill Color</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-on-surface">{visualSettings.imageFillColor}</span>
                                    <input 
                                        type="color" 
                                        value={visualSettings.imageFillColor} 
                                        onChange={e => setVisualSettings({...visualSettings, color: e.target.value})}
                                        className="w-5 h-5 rounded cursor-pointer border-none bg-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                     </div>
                </div>
            </div>

            <div className="p-4 bg-surface/50 rounded-xl border border-surface/50">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-on-surface mb-3 tracking-wider">
                    <Sliders size={14} /> Sort Settings
                </div>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 text-sm cursor-pointer group">
                        <input type="checkbox" checked={sortConfig.allowRotate} onChange={e => setSortConfig({...sortConfig, allowRotate: e.target.checked})} className="rounded bg-surface-700 border-surface-600 text-primary focus:ring-offset-background w-4 h-4 cursor-pointer"/>
                        <span className="group-hover:text-on-background transition-colors">Allow Rotation</span>
                    </label>
                    <label className="flex items-center gap-3 text-sm cursor-pointer group">
                        <input type="checkbox" checked={sortConfig.allowFlip} onChange={e => setSortConfig({...sortConfig, allowFlip: e.target.checked})} className="rounded bg-surface-700 border-surface-600 text-primary focus:ring-offset-background w-4 h-4 cursor-pointer"/>
                        <span className="group-hover:text-on-background transition-colors">Allow Flip</span>
                    </label>
                    <div>
                        <span className="text-xs text-on-surface block mb-1.5">Start Corner</span>
                        <div className="relative">
                          <select 
                              value={sortConfig.startCorner} 
                              onChange={e => setSortConfig({...sortConfig, startCorner: e.target.value})}
                              className="w-full bg-background border border-surface-700 text-sm rounded-lg p-2.5 text-on-surface outline-none focus:border-primary-500 appearance-none cursor-pointer hover:bg-surface transition-colors"
                          >
                              <option value="TL">Top Left</option>
                              <option value="TR">Top Right</option>
                              <option value="BL">Bottom Left</option>
                              <option value="BR">Bottom Right</option>
                          </select>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface">
                            <LayoutGrid size={14} />
                          </div>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-xs font-bold uppercase text-on-surface mb-3 tracking-wider">Containers</h3>
                <input 
                  type="text" 
                  placeholder="Search containers..." 
                  className="w-full bg-background text-on-background p-2 rounded border border-surface-700 focus:border-primary-500 outline-none text-sm mb-4"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                    {containerDefs
                        .filter(def => def.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(def => (
                        <div key={def.id} className="relative group">
                          <button 
                              onClick={() => setActiveContainers([...activeContainers, { instanceId: generateId(), defId: def.id, items: [] }])}
                              className="w-full p-2 bg-surface-800 border border-surface-700 hover:border-primary hover:bg-surface-700 rounded-lg text-center transition-all active:scale-95 group flex flex-col items-center justify-center h-16"
                          >
                              <Grid3X3 className="mb-1 text-on-surface group-hover:text-primary-400 transition-colors" size={18}/>
                              <span className="text-on-surface block truncate w-full group-hover:text-on-background">{def.name}</span>
                          </button>
                          <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditContainer(def); }}
                                className="p-1 bg-surface-700 text-on-background rounded-full hover:bg-primary shadow-lg border border-surface-600"
                                title="Edit Container"
                              >
                                <Pencil size={10} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteContainerDef(def.id); }}
                                className="p-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20"
                                title="Delete Container"
                              >
                                <Trash2 size={10} />
                              </button>
                          </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-xs font-bold uppercase text-on-surface mb-3 tracking-wider">Items</h3>
                <input 
                  type="text" 
                  placeholder="Search items..." 
                  className="w-full bg-background text-on-background p-2 rounded border border-surface-700 focus:border-primary-500 outline-none text-sm mb-4"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3 pb-8">
                    {itemDefs
                        .filter(def => def.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(def => (
                        <div 
                            key={def.id}
                            onMouseDown={(e) => handleMouseDown(e, { id: def.id, shape: def.shape, currentShape: def.shape, x: 0, y: 0 }, null, true)}
                            className="p-3 bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl cursor-grab active:cursor-grabbing group relative overflow-hidden transition-all hover:bg-surface-700"
                        >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-on-surface group-hover:text-on-background transition-colors">{def.name}</span>
                              <span className="text-xs text-on-surface group-hover:text-on-background transition-colors opacity-70">({def.weight?.toFixed(1) || '0.0'} lbs)</span>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: def.color}}></div>
                                
                                <button 
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => { e.stopPropagation(); handleEditItem(def); }}
                                  className="p-1 text-on-surface hover:text-on-background hover:bg-surface-700 rounded transition-colors"
                                  title="Edit Item"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button 
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => { e.stopPropagation(); deleteItemDef(def.id); }}
                                  className="p-1 text-on-surface hover:text-red-400 hover:bg-surface-700 rounded transition-colors"
                                  title="Delete Item"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            
                            <div className="flex justify-center items-center py-2 bg-background/50 rounded-lg group-hover:bg-background transition-colors overflow-hidden relative min-h-[30px]">
                                {def.image ? (
                                    <div className="w-full h-8 relative overflow-hidden">
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <img src={def.image} alt="preview" className="h-8 w-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: `repeat(${def.shape[0].length}, 12px)`, 
                                        gap: '2px' 
                                    }}>
                                        {def.shape.map(r => r.map((c, idx) => (
                                            <div key={idx} className={`w-[12px] h-[12px] rounded-[2px] ${c ? '' : 'opacity-0'}`} style={{ backgroundColor: c ? def.color : 'transparent' }}/>
                                        )))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-surface via-background to-background p-10 relative">
             
             {activeContainers.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-on-surface-600 animate-in fade-in zoom-in duration-500">
                     <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4 border border-surface-800 shadow-xl">
                        <Grid3X3 size={32} className="opacity-50 text-primary"/>
                     </div>
                     <p className="text-lg font-medium text-on-surface-500">No containers active.</p>
                     <p className="text-sm text-on-surface">Select a container from the sidebar to start prototyping.</p>
                 </div>
             )}

             <div className="flex flex-wrap gap-8 items-start content-start">
                 {activeContainers.map(c => {
                    const def = containerDefs.find(d => d.id === c.defId);
                    if(!def) return null;
                    return (
                        <div key={c.instanceId} className="relative group animate-in zoom-in duration-300">
                            {renderGrid(c, def)}
                        </div>
                    );
                 })}
             </div>
        </div>
      </div>

      {dragState && (
        <div 
            className="fixed pointer-events-none z-50 opacity-80"
            style={{ 
                left: mousePos.x, 
                top: mousePos.y,
                // Center the dragged item on mouse
                transform: `translate(-50%, -50%)`
            }}
        >
            <div style={{
                width: dragState.item.currentShape[0].length * (visualSettings.gridScale + GAP),
                height: dragState.item.currentShape.length * (visualSettings.gridScale + GAP),
            }}>
                <ItemVisual item={dragState.item} visualSettings={visualSettings} />
            </div>
            
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface/90 border border-surface-700 px-3 py-1.5 rounded-lg text-[10px] text-on-surface backdrop-blur flex items-center gap-2 shadow-xl">
                <span className="flex items-center gap-1"><kbd className="bg-surface-700 px-1.5 py-0.5 rounded border border-surface-600 text-on-background font-body">Q</kbd> Rotate</span>
                <div className="w-px h-3 bg-surface-700"></div>
                <span className="flex items-center gap-1"><kbd className="bg-surface-700 px-1.5 py-0.5 rounded border border-surface-600 text-on-background font-body">E</kbd> Rotate</span>
                <div className="w-px h-3 bg-surface-700"></div>
                <span className="flex items-center gap-1"><kbd className="bg-surface-700 px-1.5 py-0.5 rounded border border-surface-600 text-on-background font-body">W</kbd> Flip</span>
            </div>
        </div>
      )}
      {editorOpen && (
          <ShapeEditor 
            type={editorOpen.type} 
            initialData={editorOpen.initialData}
            onClose={() => setEditorOpen(null)}
            onSave={handleSaveEditor}
          />
      )}

      <div className="fixed bottom-4 right-4 text-xs font-medium text-on-surface bg-surface/90 px-4 py-2 rounded-full backdrop-blur pointer-events-none border border-surface-800 shadow-lg z-30 flex items-center gap-3">
          <span><span className="text-primary-400">Drag</span> to Move</span>
          <span className="w-1 h-1 bg-surface-700 rounded-full"></span>
          <span><span className="text-primary-400">Q/E</span> to Rotate</span>
          <span className="w-1 h-1 bg-surface-700 rounded-full"></span>
          <span><span className="text-primary-400">W</span> to Flip</span>
      </div>
    </div>
  );
}