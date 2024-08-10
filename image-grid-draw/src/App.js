import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Image as KonvaImage, Arrow } from 'react-konva';
import axios from 'axios';
import './App.css';

const apiPort = process.env.REACT_APP_API_PORT || 5001;

const GRID_WIDTH = 256; // Default number of grid cells in the width dimension
const GRID_HEIGHT = 256; // Default number of grid cells in the height dimension

const App = () => {
  const [drawMode, setDrawMode] = useState('draw'); // draw or erase
  const [currentFolder, setCurrentFolder] = useState(0);
  const [currentFolderName, setCurrentFolderName] = useState(''); // Add state for current folder name
  const [sceneImage, setSceneImage] = useState(null);
  const [originalSceneImage, setOriginalSceneImage] = useState(null); // Store the original scene image
  const [showOriginalScene, setShowOriginalScene] = useState(false); // Toggle for showing the original scene image
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
    const infoFile = files.find(file => file.webkitRelativePath.includes(`${folder}/info.json`));

    console.log('Scene File:', sceneFile);
    console.log('Original Scene File:', originalSceneFile);
    console.log('Query Object File:', queryObjectFile);
    console.log('Info File:', infoFile);

    if (sceneFile && originalSceneFile && queryObjectFile && infoFile) {
      const sceneReader = new FileReader();
      const originalSceneReader = new FileReader();
      const queryObjectReader = new FileReader();
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
      infoReader.onload = (e) => {
        console.log('Info File Loaded:', e.target.result);
        const infoData = JSON.parse(e.target.result);
        setInfoName(infoData.name || ''); // Set the name from info.json
      };

      sceneReader.readAsDataURL(sceneFile);
      originalSceneReader.readAsDataURL(originalSceneFile);
      queryObjectReader.readAsDataURL(queryObjectFile);
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
    setIsDrawing(true);
    handleCellClick(e);
  };

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();

    const cellWidth = imageSize.width / GRID_WIDTH;
    const cellHeight = imageSize.height / GRID_HEIGHT;

    // Calculate the position to center the rectangle on the cursor
    const rectX = pointerPosition.x - (cellWidth * rectWidth) / 2;
    const rectY = pointerPosition.y - (cellHeight * rectHeight) / 2;

    // Update the hover rectangle position
    setHoverRect({
      x: rectX,
      y: rectY
    });

    if (!isDrawing) return;
    handleCellClick(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleCellClick = (e) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const cellWidth = imageSize.width / GRID_WIDTH;
    const cellHeight = imageSize.height / GRID_HEIGHT;
    const x = Math.floor(pointerPosition.x / cellWidth);
    const y = Math.floor(pointerPosition.y / cellHeight);
    const cellKey = `${x}-${y}`;

    setCells((prevCells) => {
      const newCells = { ...prevCells };
      if (drawMode === 'draw') {
        newCells[cellKey] = true; // Mark the cell as filled
      } else if (drawMode === 'erase') {
        delete newCells[cellKey]; // Remove the filled cell
      }
      return newCells;
    });
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

  // Function to calculate arrow endpoint based on rotation
  const calculateArrowPoints = (x, y, length, rotation) => {
    const angle = (rotation * Math.PI) / 180; // Convert rotation to radians
    const endX = x + length * Math.cos(angle);
    const endY = y + length * Math.sin(angle);
    return [x, y, endX, endY];
  };

  return (
    <div className="App">
      <div className="button-container">
        <input 
          type="file" 
          webkitdirectory="true" 
          directory="true" 
          onChange={handleLoadDirectory} 
          ref={inputRef} // Attach the ref to the input element
        />
        <button onClick={() => setDrawMode('draw')}>Draw</button>
        <button onClick={() => setDrawMode('erase')}>Erase</button>
        <button onClick={handleClear}>Clear</button>
        <button onClick={handleRotate}>Rotate</button>
        <button onClick={handleSave}>Save</button>
        <button onClick={handlePreviousFolder}>Previous Folder</button>
        <button onClick={handleNextFolder}>Next Folder</button>
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
      <div className="folder-name">
        <h2>
          Current Folder: {currentFolderName} | Name: {infoName}
        </h2>
        {isAnnotated && <span style={{ color: 'green', fontSize: '24px' }}>✔️ Annotated</span>}
      </div>
      <div className="image-container" style={{ display: 'flex', justifyContent: showOriginalScene ? 'space-between' : 'center' }}>
        <div className="image-wrapper" style={{ position: 'relative' }}>
          <h3>Partial Scene</h3>
          {sceneImage && (
            <>
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
                style={{ position: 'relative', zIndex: 1 }}
              />
              <Stage
                width={imageSize.width}
                height={imageSize.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                ref={stageRef}
                style={{ position: 'absolute', top: 50, left: 0, zIndex: 2 }}
              >
                <Layer ref={layerRef}>
                  {drawGrid()}
                  {drawFilledCells()}
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
            </>
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
  );
};

export default App;
