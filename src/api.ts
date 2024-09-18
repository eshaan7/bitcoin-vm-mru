import { ActionParams } from "@stackr/sdk";
import { AllowedInputTypes } from "@stackr/sdk/machine";
import * as bitcore from "bitcore-lib";
import { Wallet } from "ethers";
import express, { Request, Response } from "express";

import { btcStateMachine } from "./stackr/machine";
import { mru } from "./stackr/mru";
import { RunTxInputs, UTXO } from "./stackr/types";

bitcore.Networks.defaultNetwork = bitcore.Networks.testnet;
bitcore.Transaction.DUST_AMOUNT = 0;
const PORT = !!process.env.PORT ? parseInt(process.env.PORT) : 3210;

interface ScriptPubKey {
  hex: string;
  type: string;
}
interface UTXOLimited {
  txid: string;
  n: number;
  sats: number;
  scriptPubKey: ScriptPubKey;
}

const convertUTXOToUTXOLimited = (utxo: UTXO): UTXOLimited => {
  // https://github.com/sadoprotocol/ordit-sdk/blob/a01f80605322ba392642ccc024a4d24009aa870b/packages/sdk/src/transactions/psbt.ts#L43-L69
  const script = bitcore.Script.fromHex(utxo.script);
  const addressType = script.toAddress().type;
  let scriptType: string;
  switch (addressType) {
    case bitcore.Address.PayToPublicKeyHash:
      scriptType = "pubkeyhash";
      break;
    case bitcore.Address.PayToScriptHash:
      scriptType = "scripthash";
      break;
    case bitcore.Address.PayToWitnessPublicKeyHash:
      scriptType = "witness_v0_keyhash";
      break;
    case bitcore.Address.PayToWitnessScriptHash:
      scriptType = "witness_v0_scripthash";
      break;
    case bitcore.Address.PayToTaproot:
      scriptType = "witness_v1_taproot";
      break;
    default:
      throw new Error("Unknown address type");
  }
  return {
    txid: utxo.txId,
    n: utxo.outputIndex,
    sats: utxo.satoshis,
    scriptPubKey: {
      hex: script.toHex(),
      type: scriptType,
    },
  };
};

const findSufficientUtxos = (utxos: UTXO[], sats: number): UTXO[] => {
  const usersUtxos = utxos.sort((a, b) => a.satoshis - b.satoshis);
  const sufficientUtxos = [];
  for (const utxo of usersUtxos) {
    if (sufficientUtxos.reduce((acc, u) => acc + u.satoshis, 0) >= sats) {
      break;
    }
    sufficientUtxos.push(utxo);
  }
  return sufficientUtxos;
};

async function api() {
  const app = express();
  app.use(express.json());
  // allow CORS
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });

  const machine = mru.stateMachines.getFirst<typeof btcStateMachine>();
  const operator = new Wallet(process.env.PRIVATE_KEY as string);

  if (!machine) {
    throw new Error("Machine not found");
  }

  /** Routes */
  app.get("/state", (_req: Request, res: Response) => {
    res.json({ state: machine.state });
  });

  app.get("/balance/:address", (req: Request, res: Response) => {
    const { address } = req.params;
    const balance = Object.values(machine.state.utxos)
      .flatMap((utxos) => utxos)
      .filter((utxo) => utxo.address === address)
      .reduce((acc, utxo) => acc + utxo.satoshis, 0);
    res.json({ balance });
  });

  app.get("/utxos/:address", (req: Request, res: Response) => {
    const { address } = req.params;
    const utxos = Object.values(machine.state.utxos)
      .flatMap((utxos) => utxos)
      .filter((utxo) => utxo.address === address);
    const utxosConverted = utxos.map(convertUTXOToUTXOLimited);
    res.json({ utxos: utxosConverted });
  });

  app.get(
    "/sufficient-utxos/:address/:value",
    (req: Request, res: Response) => {
      const { address, value } = req.params;
      const sats = parseInt(value);
      const utxos = Object.values(machine.state.utxos)
        .flatMap((utxos) => utxos)
        .filter((utxo) => utxo.address === address);
      const sufficientUtxos = findSufficientUtxos(utxos, sats);
      if (sufficientUtxos.reduce((acc, u) => acc + u.satoshis, 0) < sats) {
        res.status(400).json({ error: "Insufficient funds" });
        return;
      }
      const utxosConverted = sufficientUtxos.map(convertUTXOToUTXOLimited);
      res.json({ sufficientUtxos: utxosConverted });
    }
  );

  app.get("/transaction/:txId", (req: Request, res: Response) => {
    const { txId } = req.params;
    const txHex = machine.state.transactions[txId];
    if (!txHex) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    return res.json({ transaction: txHex });
  });

  app.post("/send-tx", async (req: Request, res: Response) => {
    const { serializedTx } = req.body;
    // verify incoming tx before submitting it to MRU
    const tx = new bitcore.Transaction(serializedTx);
    const verified = tx.verify();
    if (!verified) {
      res.status(400).json({ error: `Invalid tx. Error: ${verified}` });
      return;
    }
    if (tx.inputs.length === 0) {
      res.status(400).json({ error: "Invalid tx. Error: no inputs found." });
      return;
    }
    // if (tx.getFee() !== 0) {
    //   res.status(400).json({
    //     error:
    //       "Invalid tx. Error: tx fee not zero, fee is not supported in this VM.",
    //   });
    //   return;
    // }
    if (tx.isCoinbase()) {
      res
        .status(400)
        .json({ error: "Invalid tx. Error: coinbase tx not supported." });
      return;
    }
    const name = "runTx";
    const inputs: RunTxInputs = {
      serializedTx,
    };
    const signature = await operator.signTypedData(
      mru.config.domain,
      mru.getStfSchemaMap()[name],
      { name, inputs }
    );
    const actionParams: ActionParams = {
      name,
      inputs: inputs as unknown as AllowedInputTypes,
      signature,
      msgSender: operator.address,
    };
    const acknowledgement = await mru.submitAction(actionParams);
    res.json({ acknowledgement });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

await api();
