The Viverse-Worldtree Repository Contains components for building connections between worldtree.online and viverse.com

Worldtree.online is a metaverse websocket mirror that enables users to share realtime data between applications and virtual spaces. The below components demonstrate baseline usecases for worldtree, and art intended as starting points to be built on. 

TouchDesigner (http://derivative.ca/) - a popular realtime a/v software.

Ws.js - Manages websocket connections within viverse. 

BodyVis.js - Visualizes skeletal tracking data generated in TouchDesigner using mediapipe.

MouseOverTooltip.js - Allows user to embed mouse-over tooltips compatible with the camera manager.


Extra Details:

Ws.js - Websocket Manager for Viverse and Worldtree
  - Websocket target server and port can be customized in the script details panel.
  - Websocet servers must be added to the viverse white-list. Worldtree.online is added by default.

BodyVis.js - Visualizes skeletal tracking data generated in TouchDesigner using mediapipe.
  - Visualizes a basic skeleton
  - 14 Tracking points.
  - <= 60fps json data.

MouseOverTooltip.js - Mouse-over tooltips
  - Requires the camera manager. (Link incoming)
  - Title and details are added in the script field panel. 

More Updates Coming Soon
