import { hex } from "@scure/base";
import {
  Transaction as BTCTransaction,
  TEST_NETWORK as BTC_TEST_NETWORK,
} from "@scure/btc-signer";

import { UTXO } from "./stackr/types";

export const BTC_CLTV_BLOCKHEIGHT_LIMIT = 5e8;

export const checkTxCLTV = (
  lockTime: number,
  currentHeight: number,
  currentTimestamp: number
): boolean => {
  if (lockTime === 0) {
    return true; // Return true if nLockTime is 0
  }
  if (lockTime < BTC_CLTV_BLOCKHEIGHT_LIMIT) {
    // less than 5e8 is block height
    return currentHeight >= lockTime; // Check block height-based locktime
  }
  return currentTimestamp >= lockTime; // Check timestamp-based locktime
};

export const createTxWithOutput = (values: {
  address: string;
  satoshis: number;
}): [BTCTransaction, UTXO] => {
  const { address, satoshis } = values;
  const tx = new BTCTransaction();
  tx.addOutputAddress(address, BigInt(satoshis), BTC_TEST_NETWORK);
  const { script } = tx.getOutput(0);
  const utxo: UTXO = {
    txId: tx.id,
    outputIndex: 0,
    address: address,
    script: hex.encode(script!),
    satoshis,
  };
  return [tx, utxo];
};

export const createP2PKHTx = (values: {
  to: string;
  sats: number;
  utxos: UTXO[];
  changeAddress: string;
  signers: Uint8Array[];
}): BTCTransaction => {
  const { to, sats, utxos, changeAddress, signers } = values;
  const tx = new BTCTransaction({
    allowLegacyWitnessUtxo: true,
  });
  for (const utxo of utxos) {
    tx.addInput({
      txid: utxo.txId,
      index: utxo.outputIndex,
      witnessUtxo: {
        amount: BigInt(utxo.satoshis),
        script: hex.decode(utxo.script),
      },
    });
  }
  tx.addOutputAddress(to, BigInt(sats), BTC_TEST_NETWORK);
  const totalInputSats = utxos.reduce((acc, utxo) => acc + utxo.satoshis, 0);
  const change = totalInputSats - sats;
  if (change < 0) {
    throw new Error("Inputs sum is less than outputs sum");
  }
  if (change > 0) {
    tx.addOutputAddress(changeAddress, BigInt(change), BTC_TEST_NETWORK);
  }
  // TODO: fix for multiple signers
  for (let idx = 0; idx < tx.inputsLength; idx++) {
    tx.signIdx(signers[idx] || signers[0], idx);
  }
  tx.finalize();
  return tx;
};
