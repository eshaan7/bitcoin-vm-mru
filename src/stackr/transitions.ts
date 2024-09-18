import { REQUIRE, SolidityType, Transitions } from "@stackr/sdk/machine";

import { hex } from "@scure/base";
import {
  Transaction as BTCTransaction,
  TEST_NETWORK as BTC_TEST_NETWORK,
} from "@scure/btc-signer";

import { checkTxCLTV, createTxWithOutput } from "../btc-utils";
import { BitcoinVMState } from "./state";
import { UTXO } from "./types";

/* State transition functions */

const mintSats = BitcoinVMState.STF({
  schema: {
    ethAddress: SolidityType.ADDRESS,
    btcAddress: SolidityType.STRING,
    satoshis: SolidityType.UINT,
    timestamp: SolidityType.UINT, // nonce
  },
  handler: ({ state, msgSender, inputs }) => {
    REQUIRE(state.admins.includes(msgSender), "Only an admin can mint sats");
    const { ethAddress, btcAddress, satoshis } = inputs;
    REQUIRE(satoshis > 0, "Invalid amount of sats to mint");

    // create a tx with no inputs and 1 output (essentially minting sats for the given address)
    const [tx, utxo] = createTxWithOutput({
      address: btcAddress,
      satoshis,
    });
    const txId = tx.id;
    // TODO: handle duplicate tx/utxo
    REQUIRE(!state.transactions[txId], "Tx already exists in state");
    state.transactions[txId] = tx.hex;
    state.utxos[txId] = [utxo];

    return state;
  },
});

const runTx = BitcoinVMState.STF({
  schema: {
    serializedTx: SolidityType.STRING,
  },
  handler: ({ state, msgSender, inputs, block }) => {
    REQUIRE(state.admins.includes(msgSender), "Only an admin can run tx");
    const { serializedTx } = inputs;
    const tx = BTCTransaction.fromRaw(hex.decode(serializedTx));
    REQUIRE(tx.isFinal, `Tx is non-finalized (unsigned or partially signed).`);
    // REQUIRE(tx.fee === 0n, `Tx fee not zero. Fee is not supported in this VM.`);
    REQUIRE(
      checkTxCLTV(tx.lockTime, block.height, block.timestamp),
      `Tx CLTV check failed.`
    );
    const txId = tx.id;
    // TODO: handle duplicate tx/utxo
    REQUIRE(!state.transactions[txId], "Tx already exists in state");
    let inputsSum = 0;
    let outputsSum = 0;

    // consume input UTXOs, removing them from the state
    for (let i = 0; i < tx.inputsLength; i++) {
      const input = tx.getInput(i)!;
      const inputTxId = hex.encode(input.txid!);
      const utxos = state.utxos[inputTxId];
      REQUIRE(utxos.length > 0, "UTXO not found");

      const utxo = utxos.find((u) => u.outputIndex === input.index!);
      REQUIRE(!!utxo, "UTXO not found at the specified index");

      inputsSum += utxo!.satoshis;

      state.utxos[inputTxId] = utxos.filter(
        (u) => u.outputIndex !== input.index!
      );
    }

    // Add new UTXOs for the outputs in state
    state.utxos[txId] = [];
    for (let i = 0; i < tx.outputsLength; i++) {
      const output = tx.getOutput(i)!;
      const address = tx.getOutputAddress(i, BTC_TEST_NETWORK)!;
      const newUtxo: UTXO = {
        txId,
        outputIndex: i,
        address,
        script: hex.encode(output.script!),
        satoshis: Number(output.amount),
      };
      outputsSum += newUtxo.satoshis;
      state.utxos[txId].push(newUtxo);
    }
    // Record tx in state
    state.transactions[txId] = serializedTx;

    // Ensure inputs and outputs balance
    REQUIRE(
      inputsSum === outputsSum,
      "Tx inputs and outputs do not balance. Fee is not supported in this VM, any change should be sent back to the sender."
    );

    return state;
  },
});

export const transitions: Transitions<BitcoinVMState> = {
  mintSats,
  runTx,
};
