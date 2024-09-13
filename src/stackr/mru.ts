import { MicroRollup } from "@stackr/sdk";

import { stackrConfig } from "../../stackr.config";
import { MintSatsSchema, RunTxSchema } from "./actions";
import { BitcoinLockTimeStrategy } from "./bitcoin-locktime-strategy";
import { btcStateMachine } from "./machine";
import { initBridge } from "./bridge";

const mru = await MicroRollup({
  config: stackrConfig,
  actionSchemas: [MintSatsSchema, RunTxSchema],
  stateMachines: [btcStateMachine],
  stfSchemaMap: {
    mintSats: MintSatsSchema.identifier,
    runTx: RunTxSchema.identifier,
  },
});

mru.sequencer.setStrategy(new BitcoinLockTimeStrategy());
initBridge(mru);
await mru.init();

export { mru };
