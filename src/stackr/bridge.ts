import { Bridge } from "@stackr/sdk/plugins";
import { AbiCoder, Wallet } from "ethers";
import * as bitcore from "bitcore-lib";

import { MintSatsSchema } from "./actions";
import { AllowedInputTypes, MicroRollupResponse } from "@stackr/sdk";
import { MintSatsInputs } from "./types";

const abiCoder = AbiCoder.defaultAbiCoder();
const operator = new Wallet(process.env.PRIVATE_KEY as string);

export function initBridge(mru: MicroRollupResponse) {
  Bridge.init(mru, {
    handlers: {
      BRIDGE_WBTC: async (args) => {
        const [btcAddress, amount] = abiCoder.decode(
          ["string", "uint256"],
          args.data
        );
        const satoshis = bitcore.Unit.fromBTC(amount).toSatoshis();
        console.log(
          `[BRIDGE_WBTC ticket: #${args.ticketNumber}] Received ${amount} WBTC from ${args.submitter} to mint ${satoshis} sats to ${btcAddress}.`
        );

        const inputs: MintSatsInputs = {
          ethAddress: args.submitter,
          btcAddress,
          satoshis,
          timestamp: Date.now(),
        };
        const signature = await operator.signTypedData(
          MintSatsSchema.domain,
          MintSatsSchema.EIP712TypedData.types,
          inputs
        );
        const action = MintSatsSchema.actionFrom({
          inputs: inputs as unknown as AllowedInputTypes,
          signature,
          msgSender: operator.address,
        });

        return {
          transitionName: "mintSats",
          action,
        };
      },
    },
  });
  console.log("Listening for BRIDGE_WBTC tickets on the bridge contract...");
}
