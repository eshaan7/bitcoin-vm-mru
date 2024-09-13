import { REQUIRE, STF, Transitions } from "@stackr/sdk/machine";
import * as bitcore from "bitcore-lib";

import {
  checkTxCLTV,
  createP2PKHUtxo,
  createP2PSHUtxo,
} from "../bitcore-utils";
import { BitcoinVMState } from "./state";
import { MintSatsInputs, RunTxInputs, UTXO } from "./types";

const mintSats: STF<BitcoinVMState, MintSatsInputs> = {
  handler: ({ state, msgSender, inputs }) => {
    REQUIRE(state.admins.includes(msgSender), "Only an admin can mint sats");
    const { ethAddress, btcAddress, satoshis } = inputs;
    REQUIRE(satoshis > 0, "Invalid amount of sats to mint");
    const btcAddy = bitcore.Address.fromString(btcAddress);
    let utxo;
    if (btcAddy.isPayToPublicKeyHash()) {
      utxo = createP2PKHUtxo({
        address: btcAddy,
        satoshis,
      });
    } else if (btcAddy.isPayToScriptHash()) {
      utxo = createP2PSHUtxo({
        address: btcAddy,
        satoshis,
      });
    } else {
      throw new Error("Address is not P2PKH or P2SH");
    }
    if (!state.utxos[utxo.txId]) {
      state.utxos[utxo.txId] = [];
    }
    utxo.outputIndex = state.utxos[utxo.txId].length;
    state.utxos[utxo.txId].push(utxo);
    return state;
  },
};

const runTx: STF<BitcoinVMState, RunTxInputs> = {
  handler: ({ state, msgSender, inputs, block }) => {
    REQUIRE(state.admins.includes(msgSender), "Only an admin can run tx");
    const { serializedTx } = inputs;
    bitcore.Transaction.DUST_AMOUNT = 0;
    const tx = new bitcore.Transaction(serializedTx);
    const verified = tx.verify();
    REQUIRE(
      verified === true,
      `Invalid bitcoin transaction. Error: ${verified}`
    );
    REQUIRE(
      checkTxCLTV(tx, block.height, block.timestamp),
      `Tx CLTV check failed`
    );

    // consume input UTXOs, removing them from the state
    for (const input of tx.inputs) {
      const txId = input.prevTxId.toString("hex");
      const utxos = state.utxos[txId];
      REQUIRE(utxos.length > 0, "UTXO not found");

      const utxo = utxos.find((u) => u.outputIndex === input.outputIndex);
      REQUIRE(!!utxo, "UTXO not found at the specified index");

      // TODO: Validate the scripts (scriptSig against scriptPubKey)
      // is it required if we are calling tx.verify() above?

      state.utxos[txId] = utxos.filter(
        (u) => u.outputIndex !== input.outputIndex
      );
    }

    // Add new UTXOs for the outputs in state
    if (!state.utxos[tx.id]) {
      state.utxos[tx.id] = [];
    }
    for (const [index, output] of tx.outputs.entries()) {
      const newUtxo: UTXO = {
        txId: tx.id,
        outputIndex: index,
        address: output.script.toAddress().toString(),
        script: output.script.toHex(),
        satoshis: output.satoshis,
      };
      state.utxos[tx.id].push(newUtxo);
    }
    // Record tx in state
    state.transactions.push(tx.id);

    return state;
  },
};

export const transitions: Transitions<BitcoinVMState> = {
  mintSats,
  runTx,
};
