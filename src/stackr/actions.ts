import { ActionSchema, SolidityType } from "@stackr/sdk";

const MintSatsSchema = new ActionSchema("mint-sats", {
  ethAddress: SolidityType.ADDRESS,
  btcAddress: SolidityType.STRING,
  satoshis: SolidityType.UINT,
  timestamp: SolidityType.UINT, // nonce
});

const RunTxSchema = new ActionSchema("run-tx", {
  serializedTx: SolidityType.STRING,
});

export { MintSatsSchema, RunTxSchema };
