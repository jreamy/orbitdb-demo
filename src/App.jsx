import { useEffect, useState } from "react";
import "./App.css";
import { useDB, useOrbit } from "./provider.jsx";
import { peerIdFromString } from "@libp2p/peer-id";
import { IPFSAccessController } from "@orbitdb/core";

const addrRegex = /.*\/p2p\/(.*)\/.*\/?p2p-circuit\/.*\/?p2p\/.*/;

function App() {
  const { ipfs, orbitdb } = useOrbit();

  // node state 
  const [addrs, setAddrs] = useState({ relays: 0, addrs: 0, conns: 0 });

  // peer connection state
  const [peerID, setPeerID] = useState(null);
  const [peerConns, setPeerConns] = useState({outbound: 0, inbound: 0});
  const [gossip, setGossip] = useState({ score: null, outbound: 0, inbound: 0 });

  // database state
  const [db, setDB] = useDB();
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    console.log(messages)
  }, [messages])

  // node connectivity
  useEffect(() => {
    if (ipfs?.libp2p) {
      const intervalId = setInterval(async () => {
        // count public addresses & relays
        const addrs = ipfs.libp2p.getMultiaddrs()
        const conns = ipfs.libp2p.getConnections().length
        const relays = new Set(addrs.map((addr) => addr.toString().match(addrRegex)?.[1] ?? false).filter(x => x)).size
        setAddrs({ addrs: addrs.length, relays, conns })
      }, 1000)
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [ipfs])

  // peer connectivity
  useEffect(() => {
    if (ipfs?.libp2p && peerID) {
      const intervalId = setInterval(async () => {
        // check connections
        const peerConns = ipfs.libp2p.getConnections(peerID).filter(c => c.direct && c.status === 'open')
        setPeerConns({
          outbound: peerConns.filter(c => c.direction === 'outbound').length,
          inbound: peerConns.filter(c => c.direction === 'inbound').length,
        });

        // check gossip connectivity
        const g = ipfs.libp2p.services.pubsub;
        const score = g.score.dumpPeerScoreStats()?.[peerID]
        const streams = peerConns.map((conn) => conn.streams).flat().filter(s => s.protocol.includes("meshsub"));
        setGossip({ 
          score, 
          outbound: streams.filter(s => s.direction === 'outbound').length,
          inbound: streams.filter(s => s.direction === 'inbound').length,
        })
      }, 1000)
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [ipfs, peerID])

  // database
  useEffect(() => {
    if (db?.events) {
      db.events.on("update", async (event) => {
        console.log(event)
        setMessages(await db.all())
      });
      db.events.on("join", async (peer, heads) => {
        console.log(`join by ${peer} ${(peerID.toString() === peer.toString())}`)
        if (peerID.toString() === peer.toString()) {
          setJoined(true)
        }
      });
      db.events.on("leave", async (peer, heads) => {
        console.log(`left by ${peer} ${(peerID === peer)}`)
        if (peerID.toString() === peer.toString()) {
          setJoined(false)
        }
      });
      db.events.on("error", (err) => {
        console.log(`db error: ${err}`);
      });
      (async () => {
        setMessages(await db.all())
      })();
    }
  }, [ipfs, db]);

  return (
    <>
      <div className="card">
        <h4>Node Information</h4>
        <button
          onClick={async () =>
            // copy node id to clipboard
            await navigator.clipboard.writeText(
              ipfs?.libp2p?.peerId ? ipfs?.libp2p?.peerId?.toString() : "",
            )
          }
        >
          node id: {ipfs?.libp2p?.peerId?.toString()} {"\n"} (click to copy)
        </button>
        <br />
        <button>relays: {addrs.relays}</button>
        <button>addresses: {addrs.addrs}</button>
        <button>connections: {addrs.conns}</button>
      </div>
      <div className="card">
        <h4>Peer Information</h4>
        <strong>Peer ID: </strong>
        <input
          type="text"
          value={peerID?.toString() ?? ""}
          onChange={(event) => {
            const peerID = peerIdFromString(event.target.value)
            if (peerID) {
              setPeerID(peerID)
            }
          }}
        ></input>
        <button
          onClick={async () => {
            if (peerID && ipfs?.libp2p) {
              // dial the peer
              if (ipfs.libp2p.getConnections(peerID).length === 0) {
                try {
                  // discard old addresses
                  await ipfs.libp2p.peerStore.patch(peerID, {
                    multiaddrs: [],
                  })
                  await ipfs.libp2p.peerRouting.findPeer(peerID, {useCache: false})
                  
                  // dial peer
                  await ipfs.libp2p.dial(peerID);
                } catch (err) {
                  console.log(`failed connection to ${peerID}: ${err}`)
                }
              }

              await ipfs.libp2p.peerStore.merge(peerID, { tags: { "keep-alive-orbitdb-demo": { value: 100 } } });

              const identities = [
                ipfs.libp2p.peerId.toString(),
                peerID.toString()
              ].toSorted()

              const dbAddr = identities.join('-')
              
              setDB({
                id: dbAddr,
                options: {
                  AccessController: IPFSAccessController({
                    write: ["*"],
                  }),
                },
              })
            }
          }}
        >
          connect
        </button>
        <br/>
        <button>conns: {peerConns.outbound} ⬆️ {peerConns.inbound} ⬇️</button>
        <button>streams: {gossip.outbound} ⬆️ {gossip.inbound} ⬇️</button>
        <button>gossip: {gossip?.score?.connected ? "✅" : "❌"}</button>
        <button>db: {joined ? "✅" : "❌"}</button>
      </div>
      <div className="card">
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        ></input>
        <button onClick={async () => {
          if (db?.address) {
            await db.add(message)
            setMessage('')
          }
        }}>send</button>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {messages?.map(m => <tr key={m.hash}>
              <td>u</td><td>{m.value}</td></tr>) ?? <></>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default App;
