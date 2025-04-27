# RobloxAssetDeliveryProxy
An AssetDelivery proxy for MeshVox and other things, because Roblox now requires cookie authentication and I don't want to send my cookie to roproxy

Head to release, download, and simply run the executable.
The program should automatically retrieve your cookie and route your request to roblox's assetdelivery

On roblox, this should look like this
```lua
local url = `http://localhost:8080/v1/assetId/{assetId}`
```
This is what MeshVox requests


# Building from Source

- Install node.js
- Navigate to the project directory and open the terminal
- Enter these commands
- npm install -g pkg
- npm run build-exe
