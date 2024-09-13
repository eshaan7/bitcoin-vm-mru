import {
  AcknowledgedAction,
  BaseStrategy,
  ChainData,
  Keccak256,
} from "@stackr/sdk";
import * as bitcore from "bitcore-lib";

import { convertLockTimeToTimestamp } from "../bitcore-utils";

/**
 * BitcoinLockTimeStrategy is responsible for implementing bitcoin's CLTV (OP_CHECKLOCKTIMEVERIFY).
 * That is, it ensures that only transactions (actions for runTx STF) with a locktime that has passed can be included in the current block.
 */
export class BitcoinLockTimeStrategy extends BaseStrategy {
  constructor() {
    super("BitcoinLockTime");
  }

  async getOrderedActions(
    actions: Readonly<AcknowledgedAction[]>,
    chainData: Readonly<ChainData>
  ): Promise<Keccak256[]> {
    const actionsForOtherTransitions = actions.filter(
      ({ action }) => action.name !== "runTx"
    );
    const actionsForRunTxTransition = actions.filter(
      ({ action }) => action.name === "runTx"
    );
    const actionsValidForCurrentBlock = actionsForRunTxTransition.filter(
      ({ action }) => {
        const serializedTx = action.payload.serializedTx as string;
        const tx = new bitcore.Transaction(serializedTx);
        const nLockTime = convertLockTimeToTimestamp(tx.getLockTime());

        // If nLockTime is 0, the tx can be included in any block
        if (nLockTime === 0) {
          return true;
        }

        // If nLockTime is less than 500,000,000, it's a block height-based locktime
        if (nLockTime < bitcore.Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
          const isValid = chainData.height >= nLockTime;
          if (!isValid) {
            console.debug(
              `Action ${action.hash} has a block height-based locktime of ${nLockTime}, current block height is ${chainData.height}, so cannot be included in the current block.`
            );
            return isValid;
          }
        }

        // If nLockTime is greater than or equal to 500,000,000, it's a timestamp-based locktime
        const isValid = Date.now() >= nLockTime;
        if (!isValid) {
          console.debug(
            `Action ${action.hash} has a timestamp-based locktime of ${new Date(
              nLockTime
            ).toISOString()}, current timestamp is ${new Date(
              Date.now()
            ).toISOString()}, so cannot be included in the current block.`
          );
        }
        return isValid;
      }
    );
    const timestampOrderedActionHashes = [
      ...actionsForOtherTransitions,
      ...actionsValidForCurrentBlock,
    ]
      .sort((a, b) => a.acknowledgement.timestamp - b.acknowledgement.timestamp)
      .map(({ action }) => action.hash);
    return timestampOrderedActionHashes;
  }
}
