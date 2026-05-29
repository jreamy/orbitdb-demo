
# Orbitdb Demo

## Description

This demo application uses the vite + react framework with libp2p, helia, and orbitdb demonstrating a peer to peer application that:
 - uses public bootstrap nodes and relays
 - connects browser peers using webrtc
 - stores and synchronizes data using orbitdb

## Some development notes

### Using IPFS in a Provider

Sometimes my peers would not have the same count of open connections. One peer would show two outbound and one inbound, where the other only showed one outbound. It turns out initializing the `main.jsx` like so 
```js
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <OrbitProvider>
      <App />
    </OrbitProvider>
  </StrictMode>
);
```
causes the `OrbitProvider` to be rendered twice in development mode essentially creating two ipfs instances with the same peer id... so the nodes were correctly connecting to each other, just sometimes it was to the instance of the `OrbitProvider` that I didn't have access to.

For easier development the Provider that initializes ipfs should be outside of the `StrictMode` boundary.
```js
createRoot(document.getElementById("root")).render(
  <OrbitProvider>
    <StrictMode>
      <App />
    </StrictMode>
  </OrbitProvider>
);
```

### Identify Errors

Once I had the app managing IPFS correctly, the peers were still failing to open gossipsub streams intermittently. The connection would open, but the `peer:identify` event wouldn't trigger, which is required for the topology callback which starts up the gossip protocol. 

It turns out that the `identify` protocol doesn't error log... which is unfortunate. Using a custom build of `identify` I was able to trace down the error to the payload size being larger than the default `maxMessageSize`. 

Increasing the `maxMessageSize` and `timeout` in `./src/libp2p-config.js` has improved the reliability of the streams opening.

### Serving Blocks

The last configuration issue I had was preventing the orbitdb databases from opening. Specifically, both would open, one would fail to retrieve a block from the other, and then would start up without connecting to the peer. The databases were open, but the orbitdb `join` event was never triggered and data would not synchronize.

The default behavior of ipfs in the browser is to use the DHT in a 'client' mode, meaning it only retrieves blocks from the network, it does not advertise the blocks it has nor does it provide them to peers. This is required for a running database that needs to synchronize data, so I had to setup the `kadDHT` in server mode. 

In `./src/libp2p-config.js` the `clientMode: false` configuration is required to _allow_ server mode, even though the default behavior will still be client only. Then in `provider.jsx` the `ipfs.libp2p.services.dht.setMode('server')` actually enables block serving.

### Supporting Page Refresh

I had to fork gossipsub to get browsers nodes to correctly reconnect after one of the peers refreshes. There's a longstanding bug in gossipsub that an aborted connection can be held in memory by one of the peers, and prevent opening a 'new' stream. 

