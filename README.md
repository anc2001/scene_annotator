# Scene Annotation React App

## Installing / Running

This repo contains both the frontend under `image-grid-draw` and backend under `backend`. To initialize either project run `npm install` in the corresponding folder. Run both applications with `npm start`

The port that connects the two applications is by default 5001. This can be set with the environment variable `REACT_APP_API_PORT`  

## Annotating

To start annotating click the `Choose Files` button and point it to the folder of choice. When `save` is clicked the mask is saved under the backend folder masks. 
