import { gossipsub } from "@libp2p/gossipsub";
import { delegatedRoutingV1HttpApiClient } from "@helia/delegated-routing-v1-http-api-client";
import { delegatedHTTPRoutingDefaults } from "@helia/routers";
import { autoNAT } from "@libp2p/autonat";
import { dcutr } from "@libp2p/dcutr";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { identify, identifyPush } from "@libp2p/identify";
import { kadDHT } from "@libp2p/kad-dht";
import { ping } from "@libp2p/ping";
import { ipnsSelector } from "ipns/selector";
import { ipnsValidator } from "ipns/validator";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { noise } from "@libp2p/noise";
import { yamux } from "@libp2p/yamux";
import { bootstrap } from "@libp2p/bootstrap";
import { http } from "@libp2p/http";

// standard public bootstrap nodes
export const bootstrapConfig = {
  list: [
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
    "/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8",
    "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
  ],
};

export const Libp2pOptions = {
  addresses: {
    listen: [
      "/webrtc",
      // reserve 3 different relay nodes
      "/p2p-circuit",
      "/p2p-circuit",
      "/p2p-circuit",
    ],
  },
  transports: [
    circuitRelayTransport({ reservationConcurrency: 1 }),
    webRTCDirect(),
    webRTC(),
    webSockets(),
  ],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  peerStore: {
    persistence: true,
    threshold: 1,
  },
  connectionManager: {
    maxParallelDials: 8,
    maxPeerAddrsToDial: 200,
    dialTimeout: 60000,
    inboundUpgradeTimeout: 30000,
  },
  peerDiscovery: [
    bootstrap(bootstrapConfig),
    pubsubPeerDiscovery({
      interval: 10000,
      topics: [
        `_orbitdb_demo._peer-discovery._p2p._pubsub`,
        "_peer-discovery._p2p._pubsub",
      ],
    }),
  ],
  services: {
    autoNAT: autoNAT(),
    dcutr: dcutr(),
    dht: kadDHT({
      clientMode: false, // allow server mode
      querySelfInterval: 1000,
      validators: {
        ipns: ipnsValidator,
      },
      selectors: {
        ipns: ipnsSelector,
      },
    }),
    identify: identify({ 
      runOnLimitedConnection: false, 
      maxMessageSize: 32768, 
      timeout: 10000,
    }),
    identifyPush: identifyPush(),
    ping: ping(),
    pubsub: gossipsub({
      allowPublishToZeroTopicPeers: true,
      scoreParams: {
        topics: { "_orbitdb_demo._peer-discovery._p2p._pubsub": 100 },
      },
    }),
  },
};
