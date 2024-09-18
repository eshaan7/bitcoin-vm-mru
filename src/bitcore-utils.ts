import * as bitcore from "bitcore-lib";

import { UTXO } from "./stackr/types";

bitcore.Networks.defaultNetwork = bitcore.Networks.testnet;
bitcore.Transaction.DUST_AMOUNT = 0;

export const convertLockTimeToTimestamp = (
  nLockTime: null | number | Date
): number => {
  if (nLockTime === null) {
    return 0; // Return 0 if nLockTime is null
  }
  if (nLockTime instanceof Date) {
    return nLockTime.getTime(); // Convert Date to UNIX timestamp in seconds
  }
  return nLockTime as number; // Return nLockTime as-is if it's already a number
};

export const checkTxCLTV = (
  tx: bitcore.Transaction,
  currentHeight: number,
  currentTimestamp: number
): boolean => {
  const nLockTime = convertLockTimeToTimestamp(tx.getLockTime());
  if (nLockTime === 0) {
    return true; // Return true if nLockTime is 0
  }
  if (nLockTime < bitcore.Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    return currentHeight >= nLockTime; // Check block height-based locktime
  }
  return currentTimestamp >= nLockTime; // Check timestamp-based locktime
};

export const createUtxo = (values: {
  address: bitcore.Address;
  satoshis: number;
}): UTXO => {
  const { address, satoshis } = values;
  const script = new bitcore.Script(address);
  const utxo: UTXO = {
    txId: "0000000000000000000000000000000000000000000000000000000000000000",
    outputIndex: 0,
    address: address.toString(),
    script: script.toHex(),
    satoshis,
  };
  return utxo;
};

export const createP2PKHTx = (values: {
  to: string;
  sats: number;
  utxos: UTXO[];
  changeAddress: string;
  signers: bitcore.PrivateKey[];
}): bitcore.Transaction => {
  const { to, sats, utxos, changeAddress, signers } = values;
  const utxoObjects = utxos.map((utxo) =>
    bitcore.Transaction.UnspentOutput.fromObject(utxo)
  );
  const tx = new bitcore.Transaction()
    .fee(0)
    .from(utxoObjects)
    .to(to, sats)
    .change(changeAddress)
    .sign(signers);
  return tx;
};

export const createP2PSHTx = (values: {
  to: string;
  sats: number;
  utxos: UTXO[];
  pubKeys: bitcore.PublicKey[];
  threshold: number;
  changeAddress: string;
  signers: bitcore.PrivateKey[];
}): bitcore.Transaction => {
  const { to, sats, utxos, pubKeys, threshold, changeAddress, signers } =
    values;
  const utxoObjects = utxos.map((utxo) =>
    bitcore.Transaction.UnspentOutput.fromObject(utxo)
  );
  bitcore.Transaction.DUST_AMOUNT = 0;
  const tx = new bitcore.Transaction()
    .fee(0)
    .from(utxoObjects, pubKeys, threshold)
    .to(to, sats)
    .change(changeAddress)
    .sign(signers);
  return tx;
};
