import { State } from "@stackr/sdk/machine";
import { solidityPackedKeccak256 } from "ethers";
import { MerkleTree } from "merkletreejs";

import { BitcoinVMStateType } from "./types";

export class BitcoinVMState extends State<BitcoinVMStateType> {
  constructor(state: BitcoinVMStateType) {
    super(state);
  }

  getRootHash(): string {
    const adminHashes = this.state.admins.map((admin) =>
      solidityPackedKeccak256(["string"], [admin])
    );
    const adminsRoot = new MerkleTree(adminHashes).getHexRoot();
    // we don't need to include utxos seperately since they are included in the tx hex
    const txHashes = Object.entries(this.state.transactions).map(
      ([txId, txHex]) =>
        solidityPackedKeccak256(["string", "string"], [txId, txHex])
    );
    const txsRoot = new MerkleTree(txHashes).getHexRoot();
    const finalTree = new MerkleTree([adminsRoot, txsRoot]);
    return finalTree.getHexRoot();
  }
}
