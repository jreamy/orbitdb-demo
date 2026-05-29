import React, { useState, useEffect, createContext, useContext } from "react";

import { createHelia } from "helia";
import { createOrbitDB } from "@orbitdb/core";
import { Libp2pOptions } from "./libp2p-config";

import { IDBDatastore } from "datastore-idb";
import { LevelBlockstore } from "blockstore-level";
import { bitswap } from "@helia/block-brokers";
import { libp2pRouting } from '@helia/routers'
import { createLibp2p } from "libp2p";

export const OrbitContext = createContext();
export const useOrbit = () => useContext(OrbitContext);

export const OrbitProvider = ({ children }) => {
  const [ipfs, setIPFS] = useState();
  const [orbitdb, setOrbitDB] = useState();

  const init = () => {
    (async () => {
      const datastore = new IDBDatastore("datastore");
      const blockstore = new LevelBlockstore("./blockstore");

      // Open the stores
      await datastore.open();
      await blockstore.open();

      // Init IPFS node 
      const ipfs = await createHelia({
        libp2p: Libp2pOptions,
        blockstore,
        datastore,

        // only use bitswap, not the http gateway
        blockBrokers: [
          bitswap(),
        ]
      });
      setIPFS(ipfs);

      // allow serving blocks
      ipfs.libp2p.services.dht.setMode('server')

      // Init orbitdb instance
      const orbitdb = await createOrbitDB({ ipfs });
      setOrbitDB(orbitdb);
    })();
  };

  const close = () => {
    if (orbitdb) {
      (async () => {
        await orbitdb.stop();
      })();
    }
    if (ipfs) {
      async () => {
        await ipfs.stop();
      };
    }
  };

  useEffect(() => {
    init();
    return close;
  }, []);

  const value = {
    ipfs,
    orbitdb,
  };

  return <OrbitContext value={value}>{children}</OrbitContext>;
};

export const useDB = (init) => {
  const [params, setParams] = useState(init);
  const [db, setDB] = useState();
  const { orbitdb } = useOrbit();

  useEffect(() => {
    (async () => {
      if (params?.id) {
        console.log("joining " + params?.id);
        const newDB = await orbitdb.open(params.id, params?.options);
        setDB(newDB);
        console.log("joined " + newDB?.address);
      }
    })();

    return () => {
      if (db) db?.close();
    };
  }, [params]);

  return [db, setParams];
};
