import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Image as KonvaImage, Arrow } from 'react-konva';
import axios from 'axios';
import './App.css';

const apiPort = process.env.REACT_APP_API_PORT || 5001;

const GRID_WIDTH = 256; // Default number of grid cells in the width dimension
const GRID_HEIGHT = 256; // Default number of grid cells in the height dimension

const App = () => {
  const [drawMode, setDrawMode] = useState('draw'); // Options: 'draw', 'erase'
  const [proposedRect, setProposedRect] = useState(null); // State to track the proposed rectangle
  const [isRectPending, setIsRectPending] = useState(false); // Track if a rectangle is pending confirmation
  const [currentFolder, setCurrentFolder] = useState(0);
  const [currentFolderName, setCurrentFolderName] = useState(''); // Add state for current folder name
  const [sceneImage, setSceneImage] = useState(null);
  const [originalSceneImage, setOriginalSceneImage] = useState(null); // Store the original scene image
  const [showOriginalScene, setShowOriginalScene] = useState(false); // Toggle for showing the original scene image
  const [keyImage, setKeyImage] = useState(null); // State to store the key image
  const [queryObjectImage, setQueryObjectImage] = useState(null); // Store the query object image
  const [hoverImage, setHoverImage] = useState(null); // Store the hover image
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]); // Store files object
  const [cells, setCells] = useState({}); // Store filled cells
  const [isDrawing, setIsDrawing] = useState(false);
  const [hoverRect, setHoverRect] = useState({ x: 0, y: 0 }); // Track hover rectangle position
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 }); // Store image dimensions
  const [isAnnotated, setIsAnnotated] = useState(false); // Track if folder is annotated
  const [queryImageOpacity, setQueryImageOpacity] = useState(0.5); // Track the opacity of the query image
  const [gridOpacity, setGridOpacity] = useState(0); // Default grid opacity set to 0
  const [rotation, setRotation] = useState(0); // Track the rotation of the query image
  const [rectWidth, setRectWidth] = useState(3); // Width of the hover rectangle in grid cells
  const [rectHeight, setRectHeight] = useState(5); // Height of the hover rectangle in grid cells
  const [infoName, setInfoName] = useState(''); // Store the name from info.json
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const inputRef = useRef(null); // Create a ref for the input element
  const imageRef = useRef(null); // Create a ref for the scene image

  useEffect(() => {
    const updateStageSize = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        setImageSize({ width: rect.width, height: rect.height });
      }
    };

    window.addEventListener('resize', updateStageSize);
    updateStageSize();

    return () => {
      window.removeEventListener('resize', updateStageSize);
    };
  }, [sceneImage, showOriginalScene]); // Added showOriginalScene as a dependency to re-trigger on toggle

  useEffect(() => {
    if (files.length > 0 && folders.length > 0) {
      setCurrentFolderName(folders[0]);
      loadImages(folders[0]);
      checkAnnotation(folders[0]);
    }
  }, [files, folders]);

  const handleLoadDirectory = (e) => {
    const selectedFiles = Array.from(e.target.files); // Convert FileList to array

    const folderSet = new Set(
      selectedFiles
        .map(file => file.webkitRelativePath.split('/')[1]) // Extract top-level folder names
        .filter(folder => /^\d+$/.test(folder)) // Only keep folders named with numbers
    );

    const folderArray = Array.from(folderSet);
    console.log('Folders:', folderArray);

    setFolders(folderArray);
    setFiles(selectedFiles);

    // Reset the input value to allow re-selection of the same folder
    inputRef.current.value = '';
  };

  const loadImages = (folder) => {
    if (!files.length) {
      console.error('No files loaded');
      return;
    }

    setCurrentFolderName(folder); // Set the current folder name

    const sceneFile = files.find(file => file.webkitRelativePath.includes(`${folder}/scene.png`));
    const originalSceneFile = files.find(file => file.webkitRelativePath.includes(`${folder}/original_scene.png`));
    const queryObjectFile = files.find(file => file.webkitRelativePath.includes(`${folder}/query_object.png`));
    const keyFile = files.find(file => file.webkitRelativePath.includes(`${folder}/key.png`));
    const infoFile = files.find(file => file.webkitRelativePath.includes(`${folder}/info.json`));

    console.log('Scene File:', sceneFile);
    console.log('Original Scene File:', originalSceneFile);
    console.log('Query Object File:', queryObjectFile);
    console.log('Key Image File:', keyFile);
    console.log('Info File:', infoFile);

    if (sceneFile && originalSceneFile && queryObjectFile && keyFile && infoFile) {
      const sceneReader = new FileReader();
      const originalSceneReader = new FileReader();
      const queryObjectReader = new FileReader();
      const keyReader = new FileReader();
      const infoReader = new FileReader();

      sceneReader.onload = (e) => {
        console.log('Scene Image Loaded:', e.target.result);
        setSceneImage(e.target.result);
      };
      originalSceneReader.onload = (e) => {
        console.log('Original Scene Image Loaded:', e.target.result);
        setOriginalSceneImage(e.target.result);
      };
      queryObjectReader.onload = (e) => {
        console.log('Query Object Image Loaded:', e.target.result);
        setQueryObjectImage(e.target.result);

        // Create an image element for the hover image
        const img = new window.Image();
        img.src = e.target.result;
        img.onload = () => {
          // Calculate the RECT_WIDTH and RECT_HEIGHT based on the image size
          setRectWidth(img.width);
          setRectHeight(img.height);

          setHoverImage(img);
        };
      };
      keyReader.onload = (e) => {
        console.log('Key Image Loaded:', e.target.result);
        setKeyImage(e.target.result); // Set the key image
      };
      infoReader.onload = (e) => {
        console.log('Info File Loaded:', e.target.result);
        const infoData = JSON.parse(e.target.result);
        setInfoName(infoData.name || ''); // Set the name from info.json
      };

      sceneReader.readAsDataURL(sceneFile);
      originalSceneReader.readAsDataURL(originalSceneFile);
      queryObjectReader.readAsDataURL(queryObjectFile);
      keyReader.readAsDataURL(keyFile);
      infoReader.readAsText(infoFile);
    } else {
      console.error('One or more required files not found in the selected folder');
    }
  };

  const checkAnnotation = async (folder) => {
    const response = await axios.get(`http://localhost:${apiPort}/check`, { params: { folderName: folder } });
    setIsAnnotated(response.data.exists);
  };

  const handleMouseDown = (e) => {
    if (drawMode === 'draw' || drawMode === 'erase') {
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      const cellWidth = imageSize.width / GRID_WIDTH;
      const cellHeight = imageSize.height / GRID_HEIGHT;
      const x = Math.floor(pointerPosition.x / cellWidth);
      const y = Math.floor(pointerPosition.y / cellHeight);

      // Start drawing the rectangle
      setProposedRect({ startX: x, startY: y, endX: x, endY: y });
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const cellWidth = imageSize.width / GRID_WIDTH;
    const cellHeight = imageSize.height / GRID_HEIGHT;
    const hoverX = Math.floor(pointerPosition.x / cellWidth);
    const hoverY = Math.floor(pointerPosition.y / cellHeight);

    // Calculate the position to center the rectangle on the cursor
    let rectX = pointerPosition.x - (cellWidth * rectWidth) / 2;
    let rectY = pointerPosition.y - (cellHeight * rectHeight) / 2;
    if (isRectPending && proposedRect) {
      // Clamp hover position within the proposed rectangle
      const { startX, startY, endX, endY } = proposedRect;

      const offsetX = (imageSize.width / GRID_WIDTH) * rectWidth / 2
      const offsetY = (imageSize.height / GRID_HEIGHT) * rectHeight / 2

      // Convert rectX and rectY to
      rectX = rectX / cellWidth
      rectY = rectY / cellHeight

      rectX = Math.max(startX, Math.min(rectX, endX))
      rectY = Math.max(startY, Math.min(rectY, endY))

      rectX = (rectX * cellWidth)
      rectY = (rectY * cellHeight)
      rectX -= offsetX
      rectY -= offsetY
    }
    setHoverRect({ x: rectX, y: rectY });

    // If drawing, update the rectangle
    if (isDrawing && proposedRect) {
      setProposedRect((prev) => ({
        ...prev,
        endX: hoverX,
        endY: hoverY,
      }));
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      if (drawMode === 'erase') {
        // Finalize immediately for erase mode
        if (proposedRect) {
          const { startX, startY, endX, endY } = proposedRect;

          // Calculate rectangle boundaries
          const minX = Math.min(startX, endX);
          const maxX = Math.max(startX, endX);
          const minY = Math.min(startY, endY);
          const maxY = Math.max(startY, endY);

          // Update cells within the rectangle
          setCells((prevCells) => {
            const newCells = { ...prevCells };
            for (let x = minX; x <= maxX; x++) {
              for (let y = minY; y <= maxY; y++) {
                const cellKey = `${x}-${y}`;
                delete newCells[cellKey]; // Remove the cells for erase mode
              }
            }
            return newCells;
          });
        }
        setProposedRect(null); // Clear the proposed rectangle
      } else if (drawMode === 'draw') {
        // Set rectangle as pending for draw mode
        setIsRectPending(true);
      }
    }
    setIsDrawing(false);
  };

  const handleClearProposedRect = () => {
    setProposedRect(null);
    setIsRectPending(false);
  };

  const handleConfirmRectangle = () => {
    if (proposedRect) {
      const { startX, startY, endX, endY } = proposedRect;

      // Calculate rectangle boundaries
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);

      // Update cells within the rectangle
      setCells((prevCells) => {
        const newCells = { ...prevCells };
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            const cellKey = `${x}-${y}`;
            if (drawMode === 'draw') {
              newCells[cellKey] = true;
            } else if (drawMode === 'erase') {
              delete newCells[cellKey];
            }
          }
        }
        return newCells;
      });

      // Clear the proposed rectangle
      setProposedRect(null);
      setIsRectPending(false);
    }
  };

  const handleSave = async () => {
    const cellCanvas = document.createElement('canvas');
    cellCanvas.width = GRID_WIDTH;
    cellCanvas.height = GRID_HEIGHT;
    const cellCtx = cellCanvas.getContext('2d');

    const cellWidth = 1;
    const cellHeight = 1;

    Object.keys(cells).forEach((key) => {
      const [x, y] = key.split('-').map(Number);
      cellCtx.fillStyle = 'black';
      cellCtx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    });

    const uri = cellCanvas.toDataURL();

    await axios.post(`http://localhost:${apiPort}/save`, { image: uri, folderName: currentFolderName });
    checkAnnotation(currentFolderName); // Check annotation after saving
  };

  const handleNextFolder = () => {
    const nextFolder = (currentFolder + 1) % folders.length;
    setCurrentFolder(nextFolder);
    setCells({}); // Clear the current drawing
    loadImages(folders[nextFolder]);
    checkAnnotation(folders[nextFolder]);
  };

  const handlePreviousFolder = () => {
    const prevFolder = (currentFolder - 1 + folders.length) % folders.length;
    setCurrentFolder(prevFolder);
    setCells({}); // Clear the current drawing
    loadImages(folders[prevFolder]);
    checkAnnotation(folders[prevFolder]);
  };

  const handleClear = () => {
    setCells({});
  };

    // Function to calculate arrow endpoint based on rotation
  const calculateArrowPoints = (x, y, length, rotation) => {
    const angle = (rotation * Math.PI) / 180; // Convert rotation to radians
    const endX = x + length * Math.cos(angle);
    const endY = y + length * Math.sin(angle);
    return [x, y, endX, endY];
  };


  const drawGrid = () => {
    const cellWidth = imageSize.width / GRID_WIDTH;
    const cellHeight = imageSize.height / GRID_HEIGHT;
    const gridElements = [];

    for (let i = 0; i <= GRID_WIDTH; i++) {
      gridElements.push(
        <Line
          key={`v-${i}`}
          points={[i * cellWidth, 0, i * cellWidth, imageSize.height]}
          stroke={`rgba(0, 0, 0, ${gridOpacity})`} // Use the grid opacity value
          strokeWidth={1}
        />
      );
    }
    for (let i = 0; i <= GRID_HEIGHT; i++) {
      gridElements.push(
        <Line
          key={`h-${i}`}
          points={[0, i * cellHeight, imageSize.width, i * cellHeight]}
          stroke={`rgba(0, 0, 0, ${gridOpacity})`} // Use the grid opacity value
          strokeWidth={1}
        />
      );
    }
    return gridElements;
  };

  const drawFilledCells = () => {
    const cellWidth = imageSize.width / GRID_WIDTH;
    const cellHeight = imageSize.height / GRID_HEIGHT;
    return Object.keys(cells).map((key) => {
      const [x, y] = key.split('-').map(Number);
      return (
        <Rect
          key={key}
          x={x * cellWidth}
          y={y * cellHeight}
          width={cellWidth}
          height={cellHeight}
          fill="black"
        />
      );
    });
  };

  const handleRotate = () => {
    setRotation((prevRotation) => (prevRotation + 90) % 360);
  };

  return (
    <div className="App" style={{ display: 'flex', height: '100vh' }}>
      {/* Main content container */}
      <div className="main-content" style={{ flex: 1, overflow: 'auto' }}>
        <div className="folder-name">
          <h2>
            Current Folder: {currentFolderName} | Name: {infoName}
          </h2>
          {isAnnotated && <span style={{ color: 'green', fontSize: '24px' }}>✔️ Annotated</span>}
        </div>
        <div
          className="image-container"
          style={{
            display: 'flex',
            justifyContent: showOriginalScene ? 'space-between' : 'center',
          }}
        >
          <div className="image-wrapper" style={{ position: 'relative' }}>
            {keyImage && (
              <div style={{ marginBottom: '10px' }}>
                <img src={keyImage} alt="Key" className="key-image" />
              </div>
            )}
            <h3>Partial Scene</h3>
            {sceneImage && (
              <div style={{ position: 'relative' }}>
                <img
                  src={sceneImage}
                  alt="Scene"
                  className={showOriginalScene ? 'half-width-image' : 'full-width-image'}
                  ref={imageRef}
                  onLoad={() => {
                    if (imageRef.current) {
                      const rect = imageRef.current.getBoundingClientRect();
                      setImageSize({ width: rect.width, height: rect.height });
                    }
                  }}
                  style={{ display: 'block', zIndex: 1 }}
                />
                <Stage
                  width={imageSize.width}
                  height={imageSize.height}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  ref={stageRef}
                  style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
                >
                  <Layer ref={layerRef}>
                    {drawGrid()}
                    {drawFilledCells()}
                    {proposedRect && (
                      <Rect
                        x={Math.min(proposedRect.startX, proposedRect.endX) * (imageSize.width / GRID_WIDTH)}
                        y={Math.min(proposedRect.startY, proposedRect.endY) * (imageSize.height / GRID_HEIGHT)}
                        width={Math.abs(proposedRect.endX - proposedRect.startX) * (imageSize.width / GRID_WIDTH)}
                        height={Math.abs(proposedRect.endY - proposedRect.startY) * (imageSize.height / GRID_HEIGHT)}
                        fill="rgba(0, 0, 0, 0.3)" // Semi-transparent fill for the proposed rectangle
                        stroke="black" // Outline of the proposed rectangle
                        strokeWidth={1}
                      />
                    )}
                    {hoverImage && (
                      <>
                        <KonvaImage
                          image={hoverImage}
                          x={hoverRect.x + (imageSize.width / GRID_WIDTH) * rectWidth / 2}
                          y={hoverRect.y + (imageSize.height / GRID_HEIGHT) * rectHeight / 2}
                          width={(imageSize.width / GRID_WIDTH) * rectWidth}
                          height={(imageSize.height / GRID_HEIGHT) * rectHeight}
                          opacity={queryImageOpacity} // Set the opacity based on the query image slider value
                          rotation={rotation} // Rotate by 90 degrees each time the button is pressed
                          offsetX={(imageSize.width / GRID_WIDTH) * rectWidth / 2}
                          offsetY={(imageSize.height / GRID_HEIGHT) * rectHeight / 2}
                        />
                        <Arrow
                          points={calculateArrowPoints(
                            hoverRect.x + (imageSize.width / GRID_WIDTH) * rectWidth / 2,
                            hoverRect.y + (imageSize.height / GRID_HEIGHT) * rectHeight / 2,
                            30, // Arrow length
                            rotation // Rotation in degrees
                          )}
                          pointerLength={10}
                          pointerWidth={10}
                          fill="red"
                          stroke="red"
                          opacity={queryImageOpacity} // Set the opacity to match the query image
                        />
                      </>
                    )}
                  </Layer>
                </Stage>
              </div>
            )}
          </div>
          {showOriginalScene && (
            <div className="image-wrapper">
              <h3>Original Scene</h3>
              {originalSceneImage && <img src={originalSceneImage} alt="Original Scene" className="half-width-image" />}
            </div>
          )}
        </div>
      </div>

      {/* Button container */}
      <div
        className="button-container"
        style={{
          width: '250px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          padding: '10px',
          backgroundColor: '#f0f0f0',
          boxShadow: '0 0 5px rgba(0, 0, 0, 0.2)',
        }}
      >
        <input
          type="file"
          webkitdirectory="true"
          directory="true"
          onChange={handleLoadDirectory}
          ref={inputRef} // Attach the ref to the input element
        />
        <button onClick={handleSave}>Save Mask</button>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '10px',
          }}
        >
        <button
          onClick={handlePreviousFolder}
          style={{
            fontSize: '16px',
            padding: '10px',
            marginRight: '5px',
            cursor: 'pointer',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px', // Space between arrow and text
          }}
          aria-label="Previous Folder"
        >
          ← <span>Previous Folder</span>
        </button>
        <button
          onClick={handleNextFolder}
          style={{
            fontSize: '16px',
            padding: '10px',
            marginLeft: '5px',
            cursor: 'pointer',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px', // Space between arrow and text
          }}
          aria-label="Next Folder"
        >
          <span>Next Folder</span> →
        </button>
      </div>
      <button onClick={handleClear}>Clear Canvas</button>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '10px',
          gap: '10px', // Spacing between buttons
        }}
      >
        <button
          onClick={() => setDrawMode('draw')}
          style={{
            fontSize: '16px',
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: drawMode === 'draw' ? '#4caf50' : '#f0f0f0', // Darker green if active
            color: drawMode === 'draw' ? 'white' : 'black', // White text if active
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          Draw
        </button>
        <button
          onClick={() => setDrawMode('erase')}
          style={{
            fontSize: '16px',
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: drawMode === 'erase' ? '#4caf50' : '#f0f0f0', // Darker green if active
            color: drawMode === 'erase' ? 'white' : 'black', // White text if active
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        >
          Erase
        </button>
      </div>
      {drawMode === 'draw' && isRectPending && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '10px',
            gap: '10px', // Spacing between buttons
          }}
        >
          <button
            onClick={handleConfirmRectangle}
            style={{
              fontSize: '16px',
              padding: '10px 20px',
              cursor: 'pointer',
              backgroundColor: '#4caf50', // Green background for confirm
              color: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            Confirm Rectangle
          </button>
          <button
            onClick={handleClearProposedRect}
            style={{
              fontSize: '16px',
              padding: '10px 20px',
              cursor: 'pointer',
              backgroundColor: '#f44336', // Red background for clear
              color: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            Clear Proposed Rectangle
          </button>
        </div>
      )}
        {!isRectPending && (
          <button onClick={handleRotate}>Rotate Object</button>
        )}
        <button onClick={() => setShowOriginalScene(!showOriginalScene)}>
          {showOriginalScene ? 'Hide Original Scene' : 'Show Original Scene'}
        </button>
        <div className="opacity-slider">
          <label>Query Image Opacity: {queryImageOpacity}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={queryImageOpacity}
            onChange={(e) => setQueryImageOpacity(parseFloat(e.target.value))}
          />
        </div>
        <div className="opacity-slider">
          <label>Grid Opacity: {gridOpacity}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={gridOpacity}
            onChange={(e) => setGridOpacity(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
};

export default App;